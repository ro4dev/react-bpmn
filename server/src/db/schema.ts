/**
 * Esquema SQLite para persistencia (Fase 3 + 4).
 * Tablas: Process, ProcessVersion, User, ProcessCollaborator, Invitation.
 * Motor: node:sqlite nativo (DatabaseSync) — cero deps, verificado en Node 25.
 * WAL mode habilitado para mejor concurrencia.
 */
import { DatabaseSync } from "node:sqlite";

/**
 * Inicializa el esquema de la base de datos.
 * Crea tablas e índices si no existen (idempotente).
 */
export function initSchema(db: DatabaseSync): void {
  // Habilitar WAL mode para mejor concurrencia
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Tabla de usuarios (Fase 4)
  db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name         TEXT NOT NULL,
      avatar       TEXT,
      createdAt    TEXT NOT NULL
    );
  `);

  // Tabla de procesos (Fase 3 + ownerId Fase 4)
  db.exec(`
    CREATE TABLE IF NOT EXISTS Process (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      currentVersion INTEGER NOT NULL DEFAULT 1,
      ownerId        TEXT REFERENCES User(id) ON DELETE SET NULL,
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    );
  `);

  // Tabla de versiones inmutables (Fase 3 + authorId Fase 4)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ProcessVersion (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      processId    TEXT NOT NULL REFERENCES Process(id) ON DELETE CASCADE,
      version      INTEGER NOT NULL,
      model        TEXT NOT NULL,
      comment      TEXT,
      authorId     TEXT REFERENCES User(id) ON DELETE SET NULL,
      authorName   TEXT,
      createdAt    TEXT NOT NULL,
      UNIQUE(processId, version)
    );
  `);

  // Colaboradores por proceso (Fase 4)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ProcessCollaborator (
      processId  TEXT NOT NULL REFERENCES Process(id) ON DELETE CASCADE,
      userId     TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
      invitedAt  TEXT NOT NULL,
      PRIMARY KEY (processId, userId)
    );
  `);

  // Invitaciones pendientes (Fase 4)
  db.exec(`
    CREATE TABLE IF NOT EXISTS Invitation (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      processId  TEXT NOT NULL REFERENCES Process(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK (role IN ('editor','viewer')),
      token      TEXT NOT NULL UNIQUE,
      expiresAt  TEXT NOT NULL,
      createdAt  TEXT NOT NULL
    );
  `);

  // Refresh tokens (Fase 4)
  db.exec(`
    CREATE TABLE IF NOT EXISTS RefreshToken (
      id        TEXT PRIMARY KEY,
      userId    TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      tokenHash TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Índices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_process_updatedAt ON Process(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_process_ownerId ON Process(ownerId);
    CREATE INDEX IF NOT EXISTS idx_process_version_processId ON ProcessVersion(processId, version DESC);
    CREATE INDEX IF NOT EXISTS idx_collaborator_userId ON ProcessCollaborator(userId);
    CREATE INDEX IF NOT EXISTS idx_invitation_token ON Invitation(token);
    CREATE INDEX IF NOT EXISTS idx_invitation_email ON Invitation(email);
    CREATE INDEX IF NOT EXISTS idx_refresh_token_userId ON RefreshToken(userId);
  `);

  // Migraciones (idempotentes). SQLite no soporta ADD COLUMN IF NOT EXISTS,
  // así que inspeccionamos PRAGMA table_info antes de cada ALTER.
  addColumnIfMissing(db, "Process", "ownerId", "TEXT REFERENCES User(id) ON DELETE SET NULL");

  // Autoría de las versiones. `authorName` está desnormalizado a propósito:
  // `authorId` queda en NULL si el usuario se borra, pero el historial sigue
  // mostrando de quién era cada versión en vez de perder el dato para siempre.
  addColumnIfMissing(db, "ProcessVersion", "authorId", "TEXT REFERENCES User(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "ProcessVersion", "authorName", "TEXT");

  db.exec(`CREATE INDEX IF NOT EXISTS idx_process_ownerId ON Process(ownerId);`);
}

/** Agrega una columna si la tabla todavía no la tiene. */
function addColumnIfMissing(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}