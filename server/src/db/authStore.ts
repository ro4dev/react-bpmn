/**
 * Store de autenticación y usuarios (Fase 4).
 * SQLite con node:sqlite (DatabaseSync) — bcrypt + JWT.
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import type { User, AuthTokens, JWTPayload, Invitation } from "../../../shared/src/model/types.js";
import { initSchema } from "./schema.js";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 7;
const INVITATION_TTL_DAYS = 7;

function nowISO(): string {
  return new Date().toISOString();
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no configurado en variables de entorno");
  }
  return secret;
}

/**
 * Hash de lookup para tokens opacos (refresh + invitación).
 *
 * Se usa SHA-256 y no bcrypt a propósito: el token es un UUID/CSPRNG de 122+ bits
 * de entropía, no una contraseña de usuario, así que no necesita un KDF costoso;
 * y así la verificación es un `SELECT ... WHERE tokenHash = ?` en vez de
 * recorrer toda la tabla con un bcrypt por fila (ver AD-017).
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Store de autenticación.
 */
export class AuthStore {
  public readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    // Igual que en ProcessStore: el esquema se garantiza en el constructor.
    initSchema(this.db);
  }

  /** Crea un usuario nuevo (hash password, genera ID). */
  createUser(email: string, password: string, name: string, avatar?: string): User {
    const emailNorm = email.trim().toLowerCase();
    const existing = this.findByEmail(emailNorm);
    if (existing) throw new Error("EMAIL_EXISTS");

    const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const id = randomUUID();
    const ts = nowISO();

    this.db.prepare(
      "INSERT INTO User (id, email, passwordHash, name, avatar, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, emailNorm, passwordHash, name.trim(), avatar ?? null, ts);

    return { id, email: emailNorm, name: name.trim(), avatar: avatar ?? null, createdAt: ts };
  }

  /** Busca usuario por email (normalizado). Devuelve usuario con passwordHash para verificación interna. */
  findByEmail(email: string): { id: string; email: string; passwordHash: string; name: string; avatar: string | null; createdAt: string } | null {
    const row = this.db
      .prepare("SELECT id, email, passwordHash, name, avatar, createdAt FROM User WHERE email = ?")
      .get(email.trim().toLowerCase()) as
      | { id: string; email: string; passwordHash: string; name: string; avatar: string | null; createdAt: string }
      | undefined;
    if (!row) return null;
    return row;
  }

  /** Verifica password contra hash. */
  verifyPassword(user: { passwordHash: string }, password: string): boolean {
    return bcrypt.compareSync(password, user.passwordHash);
  }

  /** Genera access token (15 min) + refresh token (7 días, hasheado en DB). */
  issueTokens(user: User): AuthTokens {
    const payload: JWTPayload = { sub: user.id, email: user.email, name: user.name };
    const accessToken = jwt.sign(payload, jwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });

    // Refresh token opaco: el valor crudo solo viaja en la cookie httpOnly.
    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const ts = nowISO();

    this.db.prepare(
      "INSERT INTO RefreshToken (id, userId, tokenHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)",
    ).run(randomUUID(), user.id, refreshTokenHash, expiresAt, ts);

    return { accessToken, refreshToken };
  }

  /** Verifica access token y devuelve payload si válido. */
  verifyAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, jwtSecret()) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Verifica refresh token: busca por hash, chequea expiración.
   * Devuelve `{ userId, tokenId }` — el id permite revocar exactamente esa fila.
   */
  verifyRefreshToken(token: string): { userId: string; tokenId: string } | null {
    const row = this.db
      .prepare("SELECT id, userId, expiresAt FROM RefreshToken WHERE tokenHash = ?")
      .get(hashToken(token)) as { id: string; userId: string; expiresAt: string } | undefined;
    if (!row) return null;

    if (new Date(row.expiresAt) < new Date()) {
      this.db.prepare("DELETE FROM RefreshToken WHERE id = ?").run(row.id);
      return null;
    }
    return { userId: row.userId, tokenId: row.id };
  }

  /**
   * Rota el refresh token: revoca el actual y emite un par nuevo.
   * La rotación es la defensa contra reuso de un token robado: si alguien
   * intenta reutilizar el token viejo, ya no existe en la tabla.
   */
  rotateRefreshToken(oldToken: string): AuthTokens | null {
    const verified = this.verifyRefreshToken(oldToken);
    if (!verified) return null;

    this.db.prepare("DELETE FROM RefreshToken WHERE id = ?").run(verified.tokenId);

    const row = this.findById(verified.userId);
    if (!row) return null;
    return this.issueTokens(row);
  }

  /** Revoca un refresh token específico. */
  revokeRefreshToken(token: string): void {
    this.db.prepare("DELETE FROM RefreshToken WHERE tokenHash = ?").run(hashToken(token));
  }

  /** Revoca todos los refresh tokens de un usuario (logout en todos los dispositivos). */
  revokeAllUserTokens(userId: string): void {
    this.db.prepare("DELETE FROM RefreshToken WHERE userId = ?").run(userId);
  }

  /** Busca usuario por ID (sin passwordHash). */
  findById(id: string): User | null {
    const row = this.db
      .prepare("SELECT id, email, name, avatar, createdAt FROM User WHERE id = ?")
      .get(id) as
      | { id: string; email: string; name: string; avatar: string | null; createdAt: string }
      | undefined;
    if (!row) return null;
    return row;
  }

  /**
   * Crea una invitación firmada (JWT 7 días) para un email en un proceso.
   *
   * El token es un JWT con `{ iid, email, processId, role }`: aunque se filtre,
   * no se puede adulterar sin `JWT_SECRET`, y el `iid` permite invalidar la
   * invitación desde la DB aunque el token no expire. Ver AD-019.
   */
  createInvitation(email: string, processId: string, role: "editor" | "viewer", invitedBy: User): Invitation {
    const id = randomUUID();
    const emailNorm = email.trim().toLowerCase();
    const token = jwt.sign(
      { iid: id, email: emailNorm, processId, role },
      jwtSecret(),
      { expiresIn: `${INVITATION_TTL_DAYS}d` },
    );
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const ts = nowISO();

    // Re-invitar a alguien que ya tiene una invitación viva: se reemplaza.
    this.db
      .prepare("DELETE FROM Invitation WHERE email = ? AND processId = ? AND role = ?")
      .run(emailNorm, processId, role);

    this.db
      .prepare(
        "INSERT INTO Invitation (id, email, processId, role, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, emailNorm, processId, role, token, expiresAt, ts);

    console.log(
      `[invitación] ${invitedBy.email} invitó a ${emailNorm} como ${role} al proceso ${processId}\n` +
        `             token (7 días): ${token}`,
    );

    return { id, email: emailNorm, processId, role, token, expiresAt, createdAt: ts };
  }

  /** Busca invitación por token válido (no expirada). */
  findInvitationByToken(token: string): { id: string; email: string; processId: string; role: string; expiresAt: string } | null {
    // Primero confiamos en la firma del JWT.
    let payload: { iid?: string } | null = null;
    try {
      payload = jwt.verify(token, jwtSecret()) as { iid?: string };
    } catch {
      return null;
    }
    if (!payload?.iid) return null;

    // Luego exigimos que la invitación siga viva en la DB (puede haber sido revocada).
    const row = this.db
      .prepare("SELECT id, email, processId, role, expiresAt FROM Invitation WHERE id = ? AND token = ? AND expiresAt > ?")
      .get(payload.iid, token, new Date().toISOString()) as
      | { id: string; email: string; processId: string; role: string; expiresAt: string }
      | undefined;
    if (!row) return null;
    return row;
  }

  /** Invalida invitación por ID. */
  invalidateInvitation(id: string): void {
    this.db.prepare("DELETE FROM Invitation WHERE id = ?").run(id);
  }

  /** Lista invitaciones pendientes de un proceso (para el panel de compartir). */
  listInvitations(processId: string): Array<{ id: string; email: string; role: string; expiresAt: string; createdAt: string }> {
    return this.db
      .prepare(
        "SELECT id, email, role, expiresAt, createdAt FROM Invitation WHERE processId = ? ORDER BY createdAt DESC",
      )
      .all(processId) as Array<{ id: string; email: string; role: string; expiresAt: string; createdAt: string }>;
  }

  /** Borra una invitación pendiente de un proceso (cancelar invitación). */
  deleteInvitation(processId: string, invitationId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM Invitation WHERE id = ? AND processId = ?")
      .run(invitationId, processId);
    return result.changes > 0;
  }

  /** Actualiza perfil (name, avatar). */
  updateProfile(userId: string, name?: string, avatar?: string): User | null {
    const updates: string[] = [];
    const params: string[] = [];
    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name.trim());
    }
    if (avatar !== undefined) {
      updates.push("avatar = ?");
      params.push(avatar);
    }
    if (updates.length === 0) return this.findById(userId);

    params.push(userId);
    this.db.prepare(`UPDATE User SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    return this.findById(userId);
  }

  /** Cierra conexión. */
  close(): void {
    this.db.close();
  }
}

/**
 * Factoría para crear el store con ruta por defecto.
 */
export function createAuthStore(dbPath?: string): AuthStore {
  const path = dbPath ?? "server/data/processes.db";
  return new AuthStore(path);
}