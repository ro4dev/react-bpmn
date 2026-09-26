/**
 * Capa de acceso a datos para procesos (Fase 3 + 4).
 * SQLite con node:sqlite (DatabaseSync) — cero dependencias externas.
 * Versionado inmutable: cada guardado crea ProcessVersion (version+1).
 * Auth: ownerId + colaboradores (owner/editor/viewer).
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import { initSchema } from "./schema.js";
import { invalidateRoleCache, peekRole, rememberRole } from "./roleCache.js";
import type { ProcessModel, Role } from "../../../shared/src/model/types.js";

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
  /** Rol del usuario solicitante sobre este proceso (Fase 4). */
  role: Role;
}

/** Autoría de una versión. `authorId` queda en NULL si el usuario se borró. */
export interface VersionAuthor {
  authorId: string | null;
  authorName: string | null;
}

/** Versión completa de un proceso (para historial). */
export interface ProcessVersionFull extends VersionAuthor {
  id: number;
  processId: string;
  version: number;
  model: ProcessModel;
  comment: string | null;
  createdAt: string;
}

/** Metadato de versión (para listado de versiones). */
export interface ProcessVersionMeta extends VersionAuthor {
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

/**
 * Columnas de `ProcessMeta` que no salen de la tabla `Process`:
 * `versionCount` y el modelo de la última versión se resuelven con subconsultas
 * correlacionadas. Así el listado es **una** query en vez de 1 + 2N.
 */
const META_EXTRA_COLUMNS = `
  (SELECT COUNT(*) FROM ProcessVersion pv WHERE pv.processId = p.id) AS versionCount,
  (SELECT pv2.model FROM ProcessVersion pv2 WHERE pv2.processId = p.id
   ORDER BY pv2.version DESC LIMIT 1) AS latestModel
`;

/** Fila cruda de la tabla `Process` con las columnas de `META_EXTRA_COLUMNS`. */
interface RawMetaRow {
  id: string;
  name: string;
  currentVersion: number;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  latestModel: string | null;
}

/** Valores aceptados por `DatabaseSync` como parámetros. */
type SQLParams = Array<string | number | null | bigint | Uint8Array>;

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
    // El esquema se crea en el constructor (y no desde index.ts) para que
    // cualquier entry point — dev server, tests, scripts — tenga la base lista.
    // `initSchema` es idempotente.
    this.init();
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

  /**
   * `node:sqlite` devuelve `Record<string, SQLOutputValue>`, que no es
   * comparable con una interfaz (no tiene índice explícito). Estos dos helpers
   * concentran el `as unknown as` en un solo lugar por fila, en vez de repetirlo
   * en cada consulta.
   */
  private all<T>(sql: string, ...params: SQLParams): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }

  private get<T>(sql: string, ...params: SQLParams): T | undefined {
    return this.db.prepare(sql).get(...params) as unknown as T | undefined;
  }

  // --- CRUD procesos ---

  /**
   * Crea un proceso nuevo con su primera versión (v1) y colaborador owner.
   *
   * `authorName` lo pasa la ruta (que ya tiene el usuario en `req.user`): el
   * store no consulta `User` para resolver el nombre, así que no depende de que
   * exista una sesión y se puede usar con un store aislado en tests.
   */
  create(input: ProcessInput & { ownerId: string; authorName?: string }): { meta: ProcessMeta; collaborator: { processId: string; userId: string; role: "owner"; invitedAt: string } } {
    const id = randomUUID();
    const ts = nowISO();

    this.transaction(() => {
      this.db.prepare(
        "INSERT INTO Process (id, name, currentVersion, ownerId, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?)",
      ).run(id, input.name, input.ownerId, ts, ts);
      this.db.prepare(
        "INSERT INTO ProcessVersion (processId, version, model, comment, authorId, authorName, createdAt) VALUES (?, 1, ?, ?, ?, ?, ?)",
      ).run(
        id,
        JSON.stringify(input.model),
        input.comment ?? null,
        input.ownerId,
        this.resolveAuthorName(input.ownerId, input.authorName),
        ts,
      );
      this.db.prepare(
        "INSERT INTO ProcessCollaborator (processId, userId, role, invitedAt) VALUES (?, ?, 'owner', ?)",
      ).run(id, input.ownerId, ts);
    });

    invalidateRoleCache();
    const meta = this.getMeta(input.ownerId, id)!;
    return {
      meta,
      collaborator: { processId: id, userId: input.ownerId, role: "owner", invitedAt: ts },
    };
  }

  /**
   * Lista procesos donde el usuario tiene acceso (owner o colaborador).
   *
   * Una sola query: el rol sale del `LEFT JOIN` a colaboradores (con `CASE` para
   * que el owner gane siempre, que es la regla de `roleOf`) y el `versionCount`
   * y el modelo de la última versión, de subconsultas correlacionadas. Antes
   * `enrichMeta` hacía 2 queries + `roleOf` por fila, o sea 1 + 3N.
   */
  list(userId: string, filter?: { q?: string }): ProcessMeta[] {
    let sql = `
      SELECT p.id, p.name, p.currentVersion, p.ownerId, p.createdAt, p.updatedAt,
             ${META_EXTRA_COLUMNS},
             CASE WHEN p.ownerId = ? THEN 'owner' ELSE pc.role END AS viewerRole
      FROM Process p
      LEFT JOIN ProcessCollaborator pc ON p.id = pc.processId AND pc.userId = ?
      WHERE (p.ownerId = ? OR pc.userId = ?)
    `;
    const params: string[] = [userId, userId, userId, userId];

    if (filter?.q) {
      // Los paréntesis del WHERE de arriba son imprescindibles: en SQL `AND`
      // liga más fuerte que `OR`, así que sin ellos el `LIKE` solo filtraba los
      // procesos compartidos y los propios pasaban siempre.
      sql += " AND p.name LIKE ?";
      params.push(`%${filter.q}%`);
    }
    sql += " ORDER BY p.updatedAt DESC";

    const rows = this.all<RawMetaRow & { viewerRole: Role | null }>(sql, ...params);
    // El WHERE garantiza que hay acceso, así que `viewerRole` nunca llega en null.
    return rows.map((row) => this.toMeta(row, row.viewerRole ?? "viewer"));
  }

  /** Obtiene metadatos de un proceso por id (si el usuario tiene acceso). */
  getMeta(userId: string, id: string): ProcessMeta | null {
    const role = this.roleOf(userId, id);
    if (!role) return null;

    const row = this.get<RawMetaRow>(
      `SELECT p.id, p.name, p.currentVersion, p.ownerId, p.createdAt, p.updatedAt, ${META_EXTRA_COLUMNS} FROM Process p WHERE p.id = ?`,
      id,
    );
    if (!row) return null;
    return this.toMeta(row, role);
  }

  /** Obtiene el modelo completo de la última versión (si tiene acceso read). */
  getLatestModel(userId: string, id: string): ProcessModel | null {
    if (!this.canAccess(userId, id, "read")) return null;
    return this.getLatestModelInternal(id);
  }

  /**
   * Actualiza un proceso: crea una NUEVA versión (version+1).
   * Requiere permiso "write".
   */
  update(
    userId: string,
    id: string,
    input: Partial<ProcessInput> & { authorName?: string },
  ): ProcessMeta {
    if (!this.canAccess(userId, id, "write")) throw new Error("FORBIDDEN");

    const current = this.get<{ currentVersion: number }>(
      "SELECT currentVersion FROM Process WHERE id = ?",
      id,
    );
    if (!current) throw new Error(`Proceso ${id} no encontrado`);

    const newVersion = current.currentVersion + 1;
    // Sin modelo nuevo se reutiliza el de la última versión (p. ej. renombrar).
    const model = input.model ?? this.getLatestModelInternal(id);
    if (!model) throw new Error(`Proceso ${id} sin modelo`);

    const ts = nowISO();
    this.transaction(() => {
      this.db.prepare(
        "UPDATE Process SET name = COALESCE(?, name), currentVersion = ?, updatedAt = ? WHERE id = ?",
      ).run(input.name ?? null, newVersion, ts, id);
      this.db.prepare(
        "INSERT INTO ProcessVersion (processId, version, model, comment, authorId, authorName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        newVersion,
        JSON.stringify(model),
        input.comment ?? null,
        userId,
        this.resolveAuthorName(userId, input.authorName),
        ts,
      );
    });

    return this.getMeta(userId, id)!;
  }

  /** Elimina un proceso (solo owner). */
  delete(userId: string, id: string): boolean {
    if (!this.canAccess(userId, id, "delete")) throw new Error("FORBIDDEN");
    const stmt = this.db.prepare("DELETE FROM Process WHERE id = ?");
    const result = stmt.run(id);
    invalidateRoleCache();
    return result.changes > 0;
  }

  // --- Versiones ---

  /** Lista metadatos de versiones (descendente) — requiere read. */
  listVersions(userId: string, processId: string): ProcessVersionMeta[] {
    if (!this.canAccess(userId, processId, "read")) throw new Error("FORBIDDEN");
    return this.all<ProcessVersionMeta>(
      "SELECT version, comment, authorId, authorName, createdAt FROM ProcessVersion WHERE processId = ? ORDER BY version DESC",
      processId,
    );
  }

  /** Obtiene modelo completo de una versión específica — requiere read. */
  getVersion(userId: string, processId: string, version: number): ProcessVersionFull | null {
    if (!this.canAccess(userId, processId, "read")) throw new Error("FORBIDDEN");
    const row = this.get<Omit<ProcessVersionFull, "model"> & { model: string }>(
      "SELECT id, processId, version, model, comment, authorId, authorName, createdAt FROM ProcessVersion WHERE processId = ? AND version = ?",
      processId,
      version,
    );
    if (!row) return null;
    return { ...row, model: JSON.parse(row.model) };
  }

  // --- Colaboradores ---

  /** Lista colaboradores con info de usuario. */
  getCollaborators(processId: string): CollaboratorWithUser[] {
    return this.all<CollaboratorWithUser>(
      `SELECT pc.userId, u.email, u.name, pc.role, pc.invitedAt
       FROM ProcessCollaborator pc
       JOIN User u ON pc.userId = u.id
       WHERE pc.processId = ?
       ORDER BY CASE pc.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 WHEN 'viewer' THEN 2 END, pc.invitedAt`,
      processId,
    );
  }

  /** Añade/actualiza colaborador (solo owner puede invitar). Retorna el colaborador creado. */
  addCollaborator(requesterId: string, processId: string, targetUserId: string, role: "editor" | "viewer"): { processId: string; userId: string; role: "editor" | "viewer"; invitedAt: string } {
    if (!this.canAccess(requesterId, processId, "manage_collaborators")) throw new Error("FORBIDDEN");
    return this.addCollaboratorDirect(processId, targetUserId, role);
  }

  /** Quita colaborador (solo owner, no se puede quitar al owner). */
  removeCollaborator(requesterId: string, processId: string, targetUserId: string): boolean {
    if (!this.canAccess(requesterId, processId, "manage_collaborators")) throw new Error("FORBIDDEN");

    // Verificar que no es owner
    const collab = this.get<{ role: string }>(
      "SELECT role FROM ProcessCollaborator WHERE processId = ? AND userId = ?",
      processId,
      targetUserId,
    );
    if (collab?.role === "owner") throw new Error("CANNOT_REMOVE_OWNER");

    const stmt = this.db.prepare("DELETE FROM ProcessCollaborator WHERE processId = ? AND userId = ?");
    const result = stmt.run(processId, targetUserId);
    invalidateRoleCache();
    return result.changes > 0;
  }

  /** Verifica si un usuario puede realizar una acción en un proceso. */
  canAccess(userId: string, processId: string, action: ProcessAction): boolean {
    const role = this.roleOf(userId, processId);
    if (!role) return false;

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

  /**
   * Rol de un usuario sobre un proceso, o `null` si no tiene acceso.
   * El owner gana siempre: aunque quedara un `ProcessCollaborator` con otro rol,
   * `Process.ownerId` es la fuente de verdad.
   *
   * El resultado se memoiza por request (ver `roleCache.ts`); fuera de un
   * request — tests, scripts — cada llamada consulta la DB.
   */
  roleOf(userId: string, processId: string): Role | null {
    const cached = peekRole(userId, processId);
    if (cached !== undefined) return cached as Role | null;

    const ownerRow = this.get<{ ownerId: string | null }>(
      "SELECT ownerId FROM Process WHERE id = ?",
      processId,
    );
    if (ownerRow?.ownerId === userId) {
      rememberRole(userId, processId, "owner");
      return "owner";
    }
    if (!ownerRow) return null;

    const collab = this.get<{ role: string }>(
      "SELECT role FROM ProcessCollaborator WHERE processId = ? AND userId = ?",
      processId,
      userId,
    );
    const role = collab ? (collab.role as Role) : null;
    rememberRole(userId, processId, role);
    return role;
  }

  /**
   * Añade/actualiza colaborador sin chequeo de permisos.
   *
   * Reservado para rutas donde el permiso ya fue validado por otro medio
   * (aceptar una invitación: el owner ya lo autorizó al emitirla).
   */
  addCollaboratorDirect(processId: string, userId: string, role: "editor" | "viewer"): { processId: string; userId: string; role: "editor" | "viewer"; invitedAt: string } {
    const ts = nowISO();
    this.db.prepare(
      "INSERT OR REPLACE INTO ProcessCollaborator (processId, userId, role, invitedAt) VALUES (?, ?, ?, ?)",
    ).run(processId, userId, role, ts);
    // El rol del target recién de aparecer: el caché de este request quedó viejo.
    invalidateRoleCache();
    return { processId, userId, role, invitedAt: ts };
  }

  // --- Helpers privados ---

  /**
   * Nombre del autor de una versión.
   *
   * Las rutas lo pasan desde `req.user`, así que el caso normal no consulta
   * nada. El fallback existe para que la fila nunca quede a medias si alguien
   * llama al store directo (tests, scripts): una versión con `authorId` pero sin
   * `authorName` se vería "sin autor" en la UI aunque el usuario exista.
   */
  private resolveAuthorName(userId: string, provided?: string): string | null {
    if (provided) return provided;
    return this.get<{ name: string }>("SELECT name FROM User WHERE id = ?", userId)?.name ?? null;
  }

  /** Mapea una fila cruda a `ProcessMeta` (parsea el modelo de la última versión). */
  private toMeta(row: RawMetaRow, role: Role): ProcessMeta {
    const model = row.latestModel ? (JSON.parse(row.latestModel) as ProcessModel) : null;
    return {
      id: row.id,
      name: row.name,
      currentVersion: row.currentVersion,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      versionCount: row.versionCount,
      preview: model ? buildPreview(model) : "vacío",
      status: model ? deriveStatus(model) : "vacío",
      role,
    };
  }

  /** Obtiene modelo completo de la última versión (sin check de permisos — uso interno). */
  private getLatestModelInternal(id: string): ProcessModel | null {
    const row = this.get<{ model: string }>(
      "SELECT model FROM ProcessVersion WHERE processId = ? ORDER BY version DESC LIMIT 1",
      id,
    );
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
