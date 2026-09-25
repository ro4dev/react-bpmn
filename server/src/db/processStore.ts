/**
 * Capa de acceso a datos para procesos (Fase 3).
 * SQLite con node:sqlite (DatabaseSync) — cero dependencias externas.
 * Versionado inmutable: cada guardado crea ProcessVersion (version+1).
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
}

function nowISO(): string {
  return new Date().toISOString();
}

function buildPreview(model: ProcessModel): string {
  return `${model.nodes.length} nodos, ${model.edges.length} aristas`;
}

function deriveStatus(model: ProcessModel): ProcessMeta["status"] {
  if (model.nodes.length === 0) return "vacío";
  return "válido";
}

/**
 * Store de procesos con versionado.
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

  /** Crea un proceso nuevo con su primera versión (v1). */
  create(input: ProcessInput): ProcessMeta {
    const id = randomUUID();
    const ts = nowISO();

    this.transaction(() => {
      this.db.prepare(
        "INSERT INTO Process (id, name, currentVersion, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?)",
      ).run(id, input.name, ts, ts);
      this.db.prepare(
        "INSERT INTO ProcessVersion (processId, version, model, comment, createdAt) VALUES (?, 1, ?, ?, ?)",
      ).run(id, JSON.stringify(input.model), input.comment ?? null, ts);
    });

    return this.getMeta(id)!;
  }

  /** Lista procesos con metadatos, ordenados por updatedAt DESC. Opcional filtro por nombre. */
  list(filter?: { q?: string }): ProcessMeta[] {
    let sql = "SELECT id, name, currentVersion, createdAt, updatedAt FROM Process";
    const params: string[] = [];

    if (filter?.q) {
      sql += " WHERE name LIKE ?";
      params.push(`%${filter.q}%`);
    }
    sql += " ORDER BY updatedAt DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      name: string;
      currentVersion: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => this.enrichMeta(row));
  }

  /** Obtiene metadatos de un proceso por id. */
  getMeta(id: string): ProcessMeta | null {
    const stmt = this.db.prepare(
      "SELECT id, name, currentVersion, createdAt, updatedAt FROM Process WHERE id = ?",
    );
    const row = stmt.get(id) as
      | { id: string; name: string; currentVersion: number; createdAt: string; updatedAt: string }
      | undefined;
    if (!row) return null;
    return this.enrichMeta(row);
  }

  /** Obtiene el modelo completo de la última versión de un proceso. */
  getLatestModel(id: string): ProcessModel | null {
    const stmt = this.db.prepare(
      "SELECT model FROM ProcessVersion WHERE processId = ? ORDER BY version DESC LIMIT 1",
    );
    const row = stmt.get(id) as { model: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.model);
  }

  /**
   * Actualiza un proceso: crea una NUEVA versión (version+1).
   * No sobrescribe — mantiene historial inmutable.
   */
  update(id: string, input: Partial<ProcessInput>): ProcessMeta {
    const ts = nowISO();
    const current = this.getMeta(id);
    if (!current) throw new Error(`Proceso ${id} no encontrado`);

    const newVersion = current.currentVersion + 1;
    const model = input.model ?? this.getLatestModel(id);
    if (!model) throw new Error(`Proceso ${id} sin modelo`);

    this.transaction(() => {
      this.db.prepare(
        "UPDATE Process SET name = COALESCE(?, name), currentVersion = ?, updatedAt = ? WHERE id = ?",
      ).run(input.name ?? null, newVersion, ts, id);
      this.db.prepare(
        "INSERT INTO ProcessVersion (processId, version, model, comment, createdAt) VALUES (?, ?, ?, ?, ?)",
      ).run(id, newVersion, JSON.stringify(model), input.comment ?? null, ts);
    });

    return this.getMeta(id)!;
  }

  /** Elimina un proceso (cascada borra sus versiones). */
  delete(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM Process WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // --- Versiones ---

  /** Lista metadatos de versiones (descendente). */
  listVersions(processId: string): ProcessVersionMeta[] {
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

  /** Obtiene modelo completo de una versión específica. */
  getVersion(processId: string, version: number): ProcessVersionFull | null {
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

  // --- Helpers privados ---

  private enrichMeta(row: {
    id: string;
    name: string;
    currentVersion: number;
    createdAt: string;
    updatedAt: string;
  }): ProcessMeta {
    const stmt = this.db.prepare(
      "SELECT COUNT(*) as c FROM ProcessVersion WHERE processId = ?",
    );
    const versionCount = stmt.get(row.id) as { c: number };
    const latestModel = this.getLatestModel(row.id);
    return {
      ...row,
      versionCount: versionCount?.c ?? 0,
      preview: latestModel ? buildPreview(latestModel) : "vacío",
      status: latestModel ? deriveStatus(latestModel) : "vacío",
    };
  }

  /** Cierra la conexión (para tests/cleanup). */
  close(): void {
    this.db.close();
  }
}

/**
 * Factoría para crear el store con ruta por defecto.
 * La DB vive en server/data/processes.db (gitignored).
 */
export function createStore(dbPath?: string): ProcessStore {
  const path = dbPath ?? "server/data/processes.db";
  return new ProcessStore(path);
}