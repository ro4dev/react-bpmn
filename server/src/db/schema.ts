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

  // Tabla de versiones inmutables (Fase 3)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ProcessVersion (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      processId    TEXT NOT NULL REFERENCES Process(id) ON DELETE CASCADE,
      version      INTEGER NOT NULL,
      model        TEXT NOT NULL,
      comment      TEXT,
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

  // Migración: añadir ownerId a procesos existentes si no existe (idempotente)
  // SQLite no soporta ADD COLUMN IF NOT EXISTS, así que usamos PRAGMA table_info
  const cols = db.prepare("PRAGMA table_info(Process)").all() as Array<{ name: string }>;
  const hasOwnerId = cols.some((c) => c.name === "ownerId");
  if (!hasOwnerId) {
    db.exec(`ALTER TABLE Process ADD COLUMN ownerId TEXT REFERENCES User(id) ON DELETE SET NULL;`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_process_ownerId ON Process(ownerId);`);
  }
}