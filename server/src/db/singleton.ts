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
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAuthStore, type AuthStore } from "./authStore.js";
import { createStore, type ProcessStore } from "./processStore.js";

/**
 * Raíz del paquete `server/`, buscada subiendo desde este archivo hasta el primer
 * `package.json`.
 *
 * Hace falta porque el proceso puede arrancar con distintos CWD: `npm run dev`
 * desde la raíz lo corre con CWD en `server/`, pero `node dist/server/src/index.js`
 * puede correrse desde la raíz del repo. Resolver la ruta de la DB contra el
 * CWD producía `server/server/data/` en el primer caso.
 */
function serverRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

/** Ruta por defecto de la base de datos (configurable con DB_PATH). */
export function dbPath(): string {
  const configured = process.env.DB_PATH;
  if (!configured) return join(serverRoot(), "data", "processes.db");
  // Absoluta si empieza con `/`; relativa al paquete server en cualquier otro caso.
  return configured.startsWith("/") ? configured : join(serverRoot(), configured);
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
