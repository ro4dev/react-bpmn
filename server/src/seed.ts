/**
 * CLI del seed de datos demo: `npm run seed` (o `npm run seed -- --reset`).
 *
 * Escribe en la misma base que usa el server (`DB_PATH`), así que corre contra
 * `server/data/processes.db` por defecto. SQLite en WAL tolera que el server
 * esté o no levanta, pero conviene correrlo antes de `npm run dev`.
 *
 * `--reset` borra únicamente los datos de los usuarios demo (procesos,
 * versiones, colaboradores, invitaciones y sesiones) y vuelve a sembrar. No
 * borra el archivo de la base, así que el server que esté corriendo la ve
 * cambiar sin necesidad de reiniciarlo.
 */
import { loadEnv } from "./config/env.js";
import { closeStores, dbPath } from "./db/singleton.js";
import { DEMO_PASSWORD, DEMO_USERS, demoCatalogSummary, resetDemoData, seedDemoData } from "./db/seed.js";

loadEnv();

if (!process.env.JWT_SECRET) {
  console.error(
    "[seed] ERROR: falta JWT_SECRET.\n" +
      "       Copiá server/.env.example a server/.env antes de sembrar datos demo.",
  );
  process.exit(1);
}

const reset = process.argv.slice(2).some((a) => a === "--reset" || a === "-r");
if (reset) {
  console.log("[seed] --reset: borrando los datos demo anteriores...");
  resetDemoData();
}

const result = seedDemoData();
const summary = demoCatalogSummary();

if (result.created) {
  console.log(`[seed] Datos demo creados en ${dbPath()}\n`);
  for (const user of result.users) {
    console.log(`  ${user.email}  /  ${DEMO_PASSWORD}   (${user.name}, ${user.role})`);
  }
  console.log(
    `\n  ${result.processes} procesos · ${result.versions} versiones · ` +
      `${result.invitations} invitación pendiente`,
  );
  console.log("  por área:");
  for (const { category, count } of summary.categories) {
    console.log(`    ${String(count).padStart(3)}  ${category}`);
  }
  console.log("\n  Entradá en http://localhost:5173/login y usá el acceso rápido.");
} else {
  console.log(`[seed] Los datos demo ya estaban (${DEMO_USERS[0].email}); no se hizo nada.`);
  console.log(`[seed] Base: ${dbPath()}`);
  console.log("[seed] Para regenerarlos: npm run seed -- --reset");
}

closeStores();
