/**
 * Base de datos de los tests de browser.
 *
 * Vive acá el detalle de *cuándo* hay que sembrarla, que es lo importante:
 * Playwright levanta los `webServer` **antes** de correr el `globalSetup` (en su
 * runner, `createGlobalSetupTasks` = `removeOutputDirs` → `pluginSetup` →
 * `globalSetup`). O sea que la API abre el archivo de la base en el momento en
 * que arranca, y queda con ese inode abierto para toda la corrida.
 *
 * Si el seed corriera en el `globalSetup`, el orden real sería: la API abre la
 * base de la corrida anterior → el seed borra el archivo y crea uno nuevo con
 * los datos frescos → la API sigue sirviendo el archivo viejo, ya borrado del
 * disco. Los tests entonces leen data vieja y fallan por motivos que no tienen
 * nada que ver con el código: es la trampa en la que se cayó la suite cuando el
 * catálogo pasó de 2 a 100 procesos.
 *
 * Por eso el sembrado va en un paso previo (`pretest:ui` → `e2e/prepare.ts`),
 * antes de que exista un solo server, y el `globalSetup` solo *verifica* que lo
 * que hay en disco sea lo que la API está sirviendo.
 *
 * Acá no se importa nada de `shared/` a propósito: este módulo lo corre también
 * `node --experimental-strip-types`, que resuelve los `.js` a `.ts` de otra
 * manera que el loader de Playwright.
 */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

/** Base propia de los tests: no toca los datos de desarrollo. */
export const E2E_DB_PATH = path.join(here, ".tmp", "e2e.db");

/** El seed firma tokens de invitación, así que necesita un secreto propio. */
export const E2E_JWT_SECRET = "e2e-secret-de-tests-no-usar-en-produccion-0123456789";

/** API de los tests: puerto propio para no chocar con la de desarrollo. */
export const E2E_API_PORT = 4100;
/** Web de los tests: puerto propio para no chocar con la de desarrollo. */
export const E2E_WEB_PORT = 5174;

/** Tamaño del catálogo demo (`server/src/db/demoProcesses.ts`). */
export const EXPECTED_PROCESSES = 100;

/** Usuario demo dueño del catálogo (para preguntarle a la API por la lista). */
export const DEMO_USER = { email: "ana@demo.local", password: "demo1234" };

/**
 * Borra la base de los tests y la vuelve a sembrar.
 *
 * Idempotente y sin server de por medio: usa el mismo seed que el desarrollo.
 */
export function prepareE2EDb(): void {
  // El seed es idempotente, pero si una corrida anterior dejó datos de prueba
  // el listado no tendría las cifras que los tests esperan.
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${E2E_DB_PATH}${suffix}`, { force: true });
  }

  execFileSync("npm", ["run", "seed"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DB_PATH: E2E_DB_PATH, JWT_SECRET: E2E_JWT_SECRET },
  });
}

/** Nombres de los procesos de la base, ordenados. */
export function readDbProcessNames(): string[] {
  const db = new DatabaseSync(E2E_DB_PATH, { readOnly: true });
  try {
    const rows = db.prepare("SELECT name FROM Process ORDER BY name").all() as { name: string }[];
    return rows.map((r) => r.name);
  } finally {
    db.close();
  }
}
