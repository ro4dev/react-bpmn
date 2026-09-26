/**
 * Preparación de la corrida de browser: base limpia y sembrada.
 *
 * Corre antes de que se levanten los servidores. Siembra con `npm run seed`
 * apuntando a la DB temporal de los tests, así que no toca los datos de
 * desarrollo ni necesita que haya un server levantado.
 */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

/** Debe coincidir con `DB_PATH` de `playwright.config.ts`. */
export const E2E_DB_PATH = path.join(here, ".tmp", "e2e.db");

/** El seed firma tokens de invitación, así que necesita un secreto propio. */
export const E2E_JWT_SECRET = "e2e-secret-de-tests-no-usar-en-produccion-0123456789";

export default function globalSetup(): void {
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
