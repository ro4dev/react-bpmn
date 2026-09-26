/**
 * Punto de entrada del servidor.
 * Levanta la aplicación Express en el puerto definido por PORT (default: 4000).
 * Carga el .env y valida la configuración crítica antes de escuchar.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { app } from "./app.js";
import { loadEnv } from "./config/env.js";
import { dbPath, getAuthStore, getProcessStore } from "./db/singleton.js";

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
