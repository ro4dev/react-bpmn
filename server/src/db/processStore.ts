/**
 * Capa de acceso a datos para procesos (Fase 3 + 4).
 * SQLite con node:sqlite (DatabaseSync) — cero dependencias externas.
 * Versionado inmutable: cada guardado crea ProcessVersion (version+1).
 * Auth: ownerId + colaboradores (owner/editor/viewer).
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import { initSchema } from "./schema.js";
import type { ProcessModel } from "@shared/model/types";

/** Metadatos de un proceso (para listado). */
export interface ProcessMeta {
  id: string;
  name: string;
  currentVersion: number;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  /** Preview textual del modelo (p. ej. "3 nodos, 2 aristas"). */
  preview: string;
  /** Estado derivado: "válido" | "con-errores" | "con-advertencias" | "vacío". */
  status: "válido" | "con-errores" | "con-advertencias" | "vacío";
}

/** Versión completa de un proceso (para historial). */
export interface ProcessVersionFull {
  id: number;
  processId: string;
  version: number;
  model: ProcessModel;
  comment: string | null;
  createdAt: string;
}

/** Metadato de versión (para listado de versiones). */
export interface ProcessVersionMeta {
  version: number;
  comment: string | null;
  createdAt: string;
}

/** Input para crear/actualizar proceso. */
export interface ProcessInput {
  name: string;
  model: ProcessModel;
  comment?: string;
  ownerId?: string;
}

/** Colaborador con info de usuario. */
export interface CollaboratorWithUser {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  invitedAt: string;
}

/** Permisos de acción. */
export type ProcessAction = "read" | "write" | "delete" | "manage_collaborators";

function nowISO(): string {
  return new Date().toISOString();
}

function buildPreview(model: ProcessModel): string {
  return `${model.nodes.length} nodos, ${model.edges.length} aristas`;
}

function deriveStatus(model: ProcessModel): "válido" | "con-errores" | "con-advertencias" | "vacío" {
  if (model.nodes.length === 0) return "vacío";
  return "válido";
}

/**
 * Store de procesos con versionado + permisos.
 * No expone SQL; API pura para la capa de rutas.
 */
export class ProcessStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  /** Inicializa el esquema (idempotente). */
  init(): void {
    initSchema(this.db);
  }

  // --- Transacción helper ---
  private transaction(fn: () => void): void {
    this.db.exec("BEGIN");
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  // --- CRUD procesos ---

  /** Crea un proceso nuevo con su primera versión (v1) y colaborador owner. */
  create(input: ProcessInput & { ownerId: string }): { meta: ProcessMeta; collaborator: { processId: string; userId: string; role: "owner"; invitedAt: string } } {
    const id = randomUUID();
    const ts = nowISO();

    this.transaction(() => {
      this.db.prepare(
        "INSERT INTO Process (id, name, currentVersion, ownerId, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?)",
      ).run(id, input.name, input.ownerId, ts, ts);
      this.db.prepare(
        "INSERT INTO ProcessVersion (processId, version, model, comment, createdAt) VALUES (?, 1, ?, ?, ?)",
      ).run(id, JSON.stringify(input.model), input.comment ?? null, ts);
      this.db.prepare(
        "INSERT INTO ProcessCollaborator (processId, userId, role, invitedAt) VALUES (?, ?, 'owner', ?)",
      ).run(id, input.ownerId, ts);
    });

    const meta = this.getMeta(input.ownerId, id)!;
    return {
      meta,
      collaborator: { processId: id, userId: input.ownerId, role: "owner", invitedAt: ts },
    };
  }

  /** Lista procesos donde el usuario tiene acceso (owner o colaborador). */
  list(userId: string, filter?: { q?: string }): ProcessMeta[] {
    let sql = `
      SELECT DISTINCT p.id, p.name, p.currentVersion, p.ownerId, p.createdAt, p.updatedAt
      FROM Process p
      LEFT JOIN ProcessCollaborator pc ON p.id = pc.processId
      WHERE p.ownerId = ? OR pc.userId = ?
    `;
    const params: string[] = [userId, userId];

    if (filter?.q) {
      sql += " AND p.name LIKE ?";
      params.push(`%${filter.q}%`);
    }
    sql += " ORDER BY p.updatedAt DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      name: string;
      currentVersion: number;
      ownerId: string | null;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => this.enrichMeta(row));
  }

  /** Obtiene metadatos de un proceso por id (si el usuario tiene acceso). */
  getMeta(userId: string, id: string): ProcessMeta | null {
    const stmt = this.db.prepare(
      "SELECT id, name, currentVersion, ownerId, createdAt, updatedAt FROM Process WHERE id = ?",
    );
    const row = stmt.get(id) as
      | { id: string; name: string; currentVersion: number; ownerId: string | null; createdAt: string; updatedAt: string }
      | undefined;
    if (!row) return null;
    if (!this.canAccess(userId, id, "read")) return null;
    return this.enrichMeta(row);
  }

  /** Obtiene el modelo completo de la última versión (si tiene acceso read). */
  getLatestModel(userId: string, id: string): ProcessModel | null {
    if (!this.canAccess(userId, id, "read")) return null;
    const stmt = this.db.prepare(
      "SELECT model FROM ProcessVersion WHERE processId = ? ORDER BY version DESC LIMIT 1",
    );
    const row = stmt.get(id) as { model: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.model);
  }

  /**
   * Actualiza un proceso: crea una NUEVA versión (version+1).
   * Requiere permiso "write".
   */
  update(userId: string, id: string, input: Partial<ProcessInput>): ProcessMeta {
    if (!this.canAccess(userId, id, "write")) throw new Error("FORBIDDEN");

    const ts = nowISO();
    const current = this.getMeta(userId, id);
    if (!current) throw new Error(`Proceso ${id} no encontrado`);

    const newVersion = current.currentVersion + 1;
    const model = input.model ?? this.getLatestModel(userId, id);
    if (!model) throw new Error(`Proceso ${id} sin modelo`);

    this.transaction(() => {
      this.db.prepare(
        "UPDATE Process SET name = COALESCE(?, name), currentVersion = ?, updatedAt = ? WHERE id = ?",
      ).run(input.name ?? null, newVersion, ts, id);
      this.db.prepare(
        "INSERT INTO ProcessVersion (processId, version, model, comment, createdAt) VALUES (?, ?, ?, ?, ?)",
      ).run(id, newVersion, JSON.stringify(model), input.comment ?? null, ts);
    });

    return this.getMeta(userId, id)!;
  }

  /** Elimina un proceso (solo owner). */
  delete(userId: string, id: string): boolean {
    if (!this.canAccess(userId, id, "delete")) throw new Error("FORBIDDEN");
    const stmt = this.db.prepare("DELETE FROM Process WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // --- Versiones ---

  /** Lista metadatos de versiones (descendente) — requiere read. */
  listVersions(userId: string, processId: string): ProcessVersionMeta[] {
    if (!this.canAccess(userId, processId, "read")) throw new Error("FORBIDDEN");
    const stmt = this.db.prepare(
      "SELECT version, comment, createdAt FROM ProcessVersion WHERE processId = ? ORDER BY version DESC",
    );
    const rows = stmt.all(processId) as Array<{
      version: number;
      comment: string | null;
      createdAt: string;
    }>;
    return rows;
  }

  /** Obtiene modelo completo de una versión específica — requiere read. */
  getVersion(userId: string, processId: string, version: number): ProcessVersionFull | null {
    if (!this.canAccess(userId, processId, "read")) throw new Error("FORBIDDEN");
    const stmt = this.db.prepare(
      "SELECT id, processId, version, model, comment, createdAt FROM ProcessVersion WHERE processId = ? AND version = ?",
    );
    const row = stmt.get(processId, version) as
      | { id: number; processId: string; version: number; model: string; comment: string | null; createdAt: string }
      | undefined;
    if (!row) return null;
    return {
      ...row,
      model: JSON.parse(row.model),
    };
  }

  // --- Colaboradores ---

  /** Lista colaboradores con info de usuario. */
  getCollaborators(processId: string): Array<{ userId: string; email: string; name: string; role: "owner" | "editor" | "viewer"; invitedAt: string }> {
    const stmt = this.db.prepare(`
      SELECT pc.userId, u.email, u.name, pc.role, pc.invitedAt
      FROM ProcessCollaborator pc
      JOIN User u ON pc.userId = u.id
      WHERE pc.processId = ?
      ORDER BY CASE pc.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 WHEN 'viewer' THEN 2 END, pc.invitedAt
    `);
    return stmt.all(processId) as Array<{ userId: string; email: string; name: string; role: "owner" | "editor" | "viewer"; invitedAt: string }>;
  }

  /** Añade/actualiza colaborador (solo owner puede invitar). Retorna el colaborador creado. */
  addCollaborator(requesterId: string, processId: string, targetUserId: string, role: "editor" | "viewer"): { processId: string; userId: string; role: "editor" | "viewer"; invitedAt: string } {
    if (!this.canAccess(requesterId, processId, "manage_collaborators")) throw new Error("FORBIDDEN");

    const ts = nowISO();
    this.db.prepare(
      "INSERT OR REPLACE INTO ProcessCollaborator (processId, userId, role, invitedAt) VALUES (?, ?, ?, ?)",
    ).run(processId, targetUserId, role, ts);

    return { processId, userId: targetUserId, role, invitedAt: ts };
  }

  /** Quita colaborador (solo owner, no se puede quitar al owner). */
  removeCollaborator(requesterId: string, processId: string, targetUserId: string): boolean {
    if (!this.canAccess(requesterId, processId, "manage_collaborators")) throw new Error("FORBIDDEN");

    // Verificar que no es owner
    const collab = this.db
      .prepare("SELECT role FROM ProcessCollaborator WHERE processId = ? AND userId = ?")
      .get(processId, targetUserId) as { role: string } | undefined;
    if (collab?.role === "owner") throw new Error("CANNOT_REMOVE_OWNER");

    const stmt = this.db.prepare("DELETE FROM ProcessCollaborator WHERE processId = ? AND userId = ?");
    const result = stmt.run(processId, targetUserId);
    return result.changes > 0;
  }

  /** Verifica si un usuario puede realizar una acción en un proceso. */
  canAccess(userId: string, processId: string, action: "read" | "write" | "delete" | "manage_collaborators"): boolean {
    // Owner check
    const ownerRow = this.db
      .prepare("SELECT ownerId FROM Process WHERE id = ?")
      .get(processId) as { ownerId: string | null } | undefined;
    if (ownerRow?.ownerId === userId) return true;

    // Colaborador check
    const collab = this.db
      .prepare("SELECT role FROM ProcessCollaborator WHERE processId = ? AND userId = ?")
      .get(processId, userId) as { role: string } | undefined;

    if (!collab) return false;

    const role = collab.role;
    switch (action) {
      case "read":
        return ["owner", "editor", "viewer"].includes(role);
      case "write":
        return ["owner", "editor"].includes(role);
      case "delete":
      case "manage_collaborators":
        return role === "owner";
      default:
        return false;
    }
  }

  // --- Helpers privados ---

  private enrichMeta(row: {
    id: string;
    name: string;
    currentVersion: number;
    ownerId: string | null;
    createdAt: string;
    updatedAt: string;
  }): ProcessMeta {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as c FROM ProcessVersion WHERE processId = ?",
    );
    const versionCount = stmt.get(row.id) as { c: number };
    const latestModel = this.getLatestModelInternal(row.id);
    return {
      ...row,
      versionCount: versionCount?.c ?? 0,
      preview: latestModel ? buildPreview(latestModel) : "vacío",
      status: latestModel ? deriveStatus(latestModel) : "vacío",
    };
  }

  /** Obtiene modelo completo de la última versión (sin check de permisos — uso interno). */
  private getLatestModelInternal(id: string): ProcessModel | null {
    const stmt = this.db.prepare(
      "SELECT model FROM ProcessVersion WHERE processId = ? ORDER BY version DESC LIMIT 1",
    );
    const row = stmt.get(id) as { model: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.model);
  }

  /** Cierra la conexión. */
  close(): void {
    this.db.close();
  }
}

/**
 * Factoría para crear el store con ruta por defecto.
 */
export function createStore(dbPath?: string): ProcessStore {
  const path = dbPath ?? "server/data/processes.db";
  return new ProcessStore(path);
}