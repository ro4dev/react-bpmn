/**
 * Carga de configuración por entorno (sin dependencias).
 *
 * Extraído de `index.ts` para que otros entry points — el seed, tests — tengan
 * las mismas variables (`JWT_SECRET`, `DB_PATH`, `PORT`) sin duplicar el parser.
 */
import { existsSync, readFileSync } from "node:fs";

/**
 * Carga `server/.env` con un parser minimalista `KEY=VALUE`.
 *
 * No pisa variables ya presentes en el entorno real: en producción (o en CI) lo
 * que manda es el entorno, no el archivo.
 */
export function loadEnv(): void {
  const envPath = new URL("../../.env", import.meta.url);
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
