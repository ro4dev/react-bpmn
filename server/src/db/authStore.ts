/**
 * Store de autenticación y usuarios (Fase 4).
 * SQLite con node:sqlite (DatabaseSync) — bcrypt + JWT.
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import type { User, AuthTokens, JWTPayload } from "@shared/model/types";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 7;

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
 * Store de autenticación.
 */
export class AuthStore {
  public readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
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

  /** Genera access token (15 min) + refresh token (7 días, guardado en DB). */
  issueTokens(user: User): AuthTokens {
    const payload: JWTPayload = { sub: user.id, email: user.email, name: user.name };
    const accessToken = jwt.sign(payload, jwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });

    const refreshToken = randomUUID();
    const refreshTokenHash = bcrypt.hashSync(refreshToken, BCRYPT_ROUNDS);
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

  /** Verifica refresh token (busca en DB, compara hash, chequea expiración). */
  verifyRefreshToken(token: string): { userId: string } | null {
    const tokens = this.db
      .prepare("SELECT id, userId, tokenHash, expiresAt FROM RefreshToken")
      .all() as Array<{ id: string; userId: string; tokenHash: string; expiresAt: string }>;

    for (const rt of tokens) {
      if (bcrypt.compareSync(token, rt.tokenHash)) {
        if (new Date(rt.expiresAt) < new Date()) {
          this.db.prepare("DELETE FROM RefreshToken WHERE id = ?").run(rt.id);
          return null;
        }
        return { userId: rt.userId };
      }
    }
    return null;
  }

  /** Rota refresh token: invalida el actual y emite par nuevo. */
  rotateRefreshToken(oldToken: string): AuthTokens | null {
    const verified = this.verifyRefreshToken(oldToken);
    if (!verified) return null;

    // Revocar el actual
    const tokens = this.db
      .prepare("SELECT id FROM RefreshToken WHERE userId = ?")
      .all(verified.userId) as Array<{ id: string }>;
    for (const rt of tokens) {
      if (bcrypt.compareSync(oldToken, rt.id)) {
        this.db.prepare("DELETE FROM RefreshToken WHERE id = ?").run(rt.id);
        break;
      }
    }

    const user = this.findById(verified.userId);
    if (!user) return null;
    return this.issueTokens(user);
  }

  /** Revoca un refresh token específico. */
  revokeRefreshToken(token: string): void {
    const tokens = this.db
      .prepare("SELECT id FROM RefreshToken")
      .all() as Array<{ id: string }>;
    for (const rt of tokens) {
      if (bcrypt.compareSync(token, rt.id)) {
        this.db.prepare("DELETE FROM RefreshToken WHERE id = ?").run(rt.id);
        break;
      }
    }
  }

  /** Revoca todos los refresh tokens de un usuario (logout everywhere). */
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

  /** Busca invitación por token válido (no expirada). */
  findInvitationByToken(token: string): { id: string; email: string; processId: string; role: string; expiresAt: string } | null {
    const row = this.db
      .prepare("SELECT id, email, processId, role, expiresAt FROM Invitation WHERE token = ? AND expiresAt > ?")
      .get(token, new Date().toISOString()) as
      | { id: string; email: string; processId: string; role: string; expiresAt: string }
      | undefined;
    if (!row) return null;
    return { id: row.id, email: row.email, processId: row.processId, role: row.role, expiresAt: row.expiresAt };
  }

  /** Invalida invitación por ID. */
  invalidateInvitation(id: string): void {
    this.db.prepare("DELETE FROM Invitation WHERE id = ?").run(id);
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