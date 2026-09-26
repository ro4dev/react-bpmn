/**
 * Singletons de stores SQLite (Fase 4).
 *
 * Antes cada ruta/middleware abría y cerraba su propia `DatabaseSync`, lo que:
 *  - rompía WAL (cerrar la última conexión hace checkpoint y bloquea),
 *  - creaba el archivo sin directorio (fallaba si `server/data` no existía),
 *  - costaba ~1ms de I/O por request.
 *
 * Ahora hay una única instancia por proceso, creada de forma lazy y con el
 * esquema inicializado una sola vez. Ver AD-017.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createAuthStore, type AuthStore } from "./authStore.js";
import { createStore, type ProcessStore } from "./processStore.js";

/** Ruta por defecto de la base de datos (configurable con DB_PATH). */
export function dbPath(): string {
  return process.env.DB_PATH ?? "server/data/processes.db";
}

let authStoreInstance: AuthStore | null = null;
let processStoreInstance: ProcessStore | null = null;

/** Devuelve el AuthStore singleton (crea el directorio y el schema si hace falta). */
export function getAuthStore(): AuthStore {
  if (!authStoreInstance) {
    const path = dbPath();
    mkdirSync(dirname(path), { recursive: true });
    authStoreInstance = createAuthStore(path);
  }
  return authStoreInstance;
}

/** Devuelve el ProcessStore singleton (crea el directorio y el schema si hace falta). */
export function getProcessStore(): ProcessStore {
  if (!processStoreInstance) {
    const path = dbPath();
    mkdirSync(dirname(path), { recursive: true });
    processStoreInstance = createStore(path);
  }
  return processStoreInstance;
}

/** Cierra ambos stores (solo para tests / shutdown). */
export function closeStores(): void {
  authStoreInstance?.close();
  processStoreInstance?.close();
  authStoreInstance = null;
  processStoreInstance = null;
}
