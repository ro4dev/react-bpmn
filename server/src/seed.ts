/**
 * CLI del seed de datos demo: `npm run seed`.
 *
 * Escribe en la misma base que usa el server (`DB_PATH`), así que corre contra
 * `server/data/processes.db` por defecto. SQLite en WAL tolera que el server
 * esté o no levanta, pero conviene correrlo antes de `npm run dev`.
 */
import { loadEnv } from "./config/env.js";
import { closeStores, dbPath } from "./db/singleton.js";
import { DEMO_PASSWORD, DEMO_USERS, seedDemoData } from "./db/seed.js";

loadEnv();

if (!process.env.JWT_SECRET) {
  console.error(
    "[seed] ERROR: falta JWT_SECRET.\n" +
      "       Copiá server/.env.example a server/.env antes de sembrar datos demo.",
  );
  process.exit(1);
}

const result = seedDemoData();

if (result.created) {
  console.log(`[seed] Datos demo creados en ${dbPath()}\n`);
  for (const user of result.users) {
    console.log(`  ${user.email}  /  ${DEMO_PASSWORD}   (${user.name}, ${user.role})`);
  }
  console.log(`\n  ${result.processes} procesos con historial, colaboradores e invitación pendiente.`);
  console.log("  Entradá en http://localhost:5173/login y usá el acceso rápido.");
} else {
  console.log(`[seed] Los datos demo ya estaban (${DEMO_USERS[0].email}); no se hizo nada.`);
  console.log(`[seed] Base: ${dbPath()}`);
}

closeStores();
