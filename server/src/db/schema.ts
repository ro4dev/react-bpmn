/**
 * Esquema SQLite para persistencia de procesos (Fase 3).
 * Tablas: Process (metadatos) + ProcessVersion (versiones inmutables).
 * Motor: node:sqlite nativo (DatabaseSync) — cero deps, verificado en Node 25.
 */
import { DatabaseSync } from "node:sqlite";

/**
 * Inicializa el esquema de la base de datos.
 * Crea tablas e índices si no existen.
 */
export function initSchema(db: DatabaseSync): void {
  // Tabla de procesos (metadatos + versión actual)
  db.exec(`
    CREATE TABLE IF NOT EXISTS Process (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      currentVersion INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Tabla de versiones (inmutables, una por guardado)
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

  // Índices para listado y búsqueda
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_process_updatedAt ON Process(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_process_version_processId ON ProcessVersion(processId, version DESC);
  `);
}