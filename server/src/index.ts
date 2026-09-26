/**
 * Punto de entrada del servidor.
 * Levanta la aplicación Express en el puerto definido por PORT (default: 4000).
 * Carga el .env y valida la configuración crítica antes de escuchar.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { app } from "./app.js";
import { dbPath, getAuthStore, getProcessStore } from "./db/singleton.js";

/** Carga server/.env sin dependencias externas (parser KEY=VALUE minimalista). */
function loadEnv(): void {
  const envPath = new URL("../.env", import.meta.url);
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // No sobreescribe variables ya presentes en el entorno real.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

const PORT = Number(process.env.PORT ?? 4000);

// El schema se crea al abrir el store (idempotente), y el directorio del archivo
// también — así una clone fresca arranca sin pasos manuales.
const path = dbPath();
mkdirSync(dirname(path), { recursive: true });
getProcessStore().init();
getAuthStore();
console.log(`[server] Base de datos lista en ${path}`);

if (!process.env.JWT_SECRET) {
  console.error(
    "[server] ERROR: falta JWT_SECRET.\n" +
      "         Copiá server/.env.example a server/.env y generá uno con:\n" +
      "         node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  );
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`);
});
