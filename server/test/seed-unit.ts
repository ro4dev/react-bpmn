/**
 * Tests del seed de datos demo (`src/db/seed.ts`).
 *
 * Lo importante acá no es que "cree algo", sino dos cosas que se rompen fácil:
 *  - que sea **idempotente**: correrlo dos veces no puede duplicar procesos ni
 *    pisar el trabajo real,
 *  - que los datos que crea sean **válidos**: los modelos tienen que pasar
 *    `validateProcess` (si no, el editor abre el proceso con errores) y las
 *    credenciales tienen que autenticar de verdad.
 *
 * Corre con `npm --prefix server run test:seed` sobre una DB temporal.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const tmp = mkdtempSync(join(tmpdir(), "react-bpmn-seed-"));
process.env.DB_PATH = join(tmp, "seed.db");
process.env.JWT_SECRET = "secreto-de-test-no-usar-en-produccion-0123456789";

const { closeStores, getAuthStore, getProcessStore } = await import("../dist/server/src/db/singleton.js");
const { DEMO_PASSWORD, DEMO_USERS, seedDemoData } = await import("../dist/server/src/db/seed.js");
const { validateProcess } = await import("../dist/shared/src/validation/validateProcess.js");

const authStore = getAuthStore();
const store = getProcessStore();

try {
  console.log("\n▸ Primera corrida");
  const first = seedDemoData();
  check("el seed crea datos", first.created === true && first.processes === 2, first);

  const ana = authStore.findByEmail(DEMO_USERS[0].email);
  const bruno = authStore.findByEmail(DEMO_USERS[1].email);
  check("crea los dos usuarios demo", !!ana && !!bruno);
  check("la contraseña demo autentica de verdad", authStore.verifyPassword(ana!, DEMO_PASSWORD), DEMO_PASSWORD);
  check("otra contraseña no", !authStore.verifyPassword(ana!, "otra-cosa"));

  const comoAna = store.list(ana!.id);
  const comoBruno = store.list(bruno!.id);
  check("Ana ve los 2 procesos", comoAna.length === 2, comoAna.length);
  check("Bruno ve los 2 procesos (uno como editor, uno como viewer)", comoBruno.length === 2, comoBruno.length);

  const pedido = comoAna.find((p) => p.name === "Pedido de compra")!;
  const presupuesto = comoAna.find((p) => p.name === "Aprobación de presupuesto")!;
  check("Ana es owner de los dos", pedido.role === "owner" && presupuesto.role === "owner");
  check("Ana ve 3 versiones del pedido", pedido.versionCount === 3, pedido);

  const roles = {
    pedido: store.roleOf(bruno!.id, pedido.id),
    presupuesto: store.roleOf(bruno!.id, presupuesto.id),
  };
  check("Bruno es editor de uno y viewer del otro", roles.pedido === "editor" && roles.presupuesto === "viewer", roles);

  console.log("\n▸ Autores del historial");
  const versions = store.listVersions(ana!.id, pedido.id);
  const autores = versions.map((v) => `${v.version}:${v.authorName}`);
  check("las 3 versiones tienen autor", versions.every((v) => !!v.authorName), autores);
  check("hay versiones de Ana y de Bruno", new Set(versions.map((v) => v.authorName)).size === 2, autores);

  console.log("\n▸ Invitación pendiente");
  const invitations = authStore.listInvitations(pedido.id);
  check("deja una invitación viva", invitations.length === 1, invitations);
  check("la invitación no expiró", new Date(invitations[0].expiresAt) > new Date(), invitations[0]?.expiresAt);

  console.log("\n▸ Modelos válidos (el editor no debe abrir con errores)");
  const problemas = comoAna.flatMap((p) => {
    const model = store.getLatestModel(ana!.id, p.id)!;
    return validateProcess(model)
      .filter((i: { severity: string }) => i.severity === "error")
      .map((i: { message: string }) => `${p.name}: ${i.message}`);
  });
  check("ningún proceso demo tiene errores de validación", problemas.length === 0, problemas);

  console.log("\n▸ Idempotencia");
  const second = seedDemoData();
  check("la segunda corrida no crea nada", second.created === false, second);
  // `authStore.db` es otra conexión al mismo archivo, así que cuenta lo mismo.
  const userCount = authStore.db.prepare("SELECT COUNT(*) AS c FROM User").get() as { c: number };
  const processCount = authStore.db.prepare("SELECT COUNT(*) AS c FROM Process").get() as { c: number };
  const versionCount = authStore.db.prepare("SELECT COUNT(*) AS c FROM ProcessVersion").get() as { c: number };
  check("no duplica usuarios", userCount.c === 2, userCount);
  check("no duplica procesos", processCount.c === 2, processCount);
  check("no agrega versiones", versionCount.c === 4, versionCount);
  check("el pedido sigue con 3 versiones", pedido.versionCount === 3, pedido.versionCount);
} catch (e) {
  console.error("\nEl test explota:", e);
  failed++;
} finally {
  closeStores();
}

rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
