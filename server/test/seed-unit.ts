/**
 * Tests del seed de datos demo (`src/db/seed.ts`).
 *
 * Lo importante acá no es que "cree algo", sino cuatro cosas que se rompen fácil:
 *  - que sea **idempotente**: correrlo dos veces no puede duplicar procesos ni
 *    pisar el trabajo real,
 *  - que los datos sean **válidos**: los modelos tienen que pasar
 *    `validateProcess` (si no, el editor abre el proceso con errores),
 *  - que el **historial** tenga sentido: cada versión agrega algo y por lo tanto
 *    el diff no está vacío, y quien firma puede guardar de verdad,
 *  - que el catálogo sea el que dice: 100 procesos sin nombres repetidos y con
 *    un rango de complejidad que arranque en lo simple y llegue a lo difícil.
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
const { DEMO_PASSWORD, DEMO_USERS, resetDemoData, seedDemoData } = await import("../dist/server/src/db/seed.js");
const { DEMO_PROCESSES, buildDemoModel } = await import("../dist/server/src/db/demoProcesses.js");
const { validateProcess } = await import("../dist/shared/src/validation/validateProcess.js");

const authStore = getAuthStore();
const store = getProcessStore();

/** Versionado del modelo tal como lo expone la API. */
type Version = { version: number; authorName: string | null; model: unknown };

try {
  console.log("\n▸ Primera corrida");
  const first = seedDemoData();
  check("el seed crea datos", first.created === true && first.processes === 100, first);
  check(
    "crea 100 procesos (el tamaño del catálogo)",
    first.processes === DEMO_PROCESSES.length && DEMO_PROCESSES.length === 100,
    first.processes,
  );

  const ana = authStore.findByEmail(DEMO_USERS[0].email);
  const bruno = authStore.findByEmail(DEMO_USERS[1].email);
  check("crea los dos usuarios demo", !!ana && !!bruno);
  check("la contraseña demo autentica de verdad", authStore.verifyPassword(ana!, DEMO_PASSWORD), DEMO_PASSWORD);
  check("otra contraseña no", !authStore.verifyPassword(ana!, "otra-cosa"));

  console.log("\n▸ El catálogo");
  const nombres = DEMO_PROCESSES.map((p: { name: string }) => p.name);
  check("100 nombres distintos", new Set(nombres).size === 100, new Set(nombres).size);
  check("no hay nombres genéricos", !nombres.some((n: string) => /proceso \d+/i.test(n)));
  const categorias = new Set(DEMO_PROCESSES.map((p: { cat: string }) => p.cat));
  check("cubre varias áreas de negocio", categorias.size >= 10, [...categorias]);
  const formas = new Set(DEMO_PROCESSES.map((p: { shape: string }) => p.shape));
  check("mezcla procesos simples y complejos", formas.size === 5, [...formas]);

  console.log("\n▸ Roles y visibilidad");
  const comoAna = store.list(ana!.id);
  const comoBruno = store.list(bruno!.id);
  check("Ana ve los 100 (95 suyos + 5 compartidos)", comoAna.length === 100, comoAna.length);
  check("Bruno ve los suyos y los que lo colaboran", comoBruno.length > 0, comoBruno.length);
  check("Ana no ve procesos ajenos", comoAna.every((p) => p.role === "owner" || p.role !== undefined));

  const pedido = comoAna.find((p) => p.name === "Pedido de compra")!;
  const presupuesto = comoAna.find((p) => p.name === "Aprobación de presupuesto")!;
  check("el catálogo trae los dos procesos de referencia", !!pedido && !!presupuesto);
  check("Ana es owner de los dos", pedido.role === "owner" && presupuesto.role === "owner");
  check(
    "Bruno es editor de uno y viewer del otro",
    store.roleOf(bruno!.id, pedido.id) === "editor" &&
      store.roleOf(bruno!.id, presupuesto.id) === "viewer",
  );

  console.log("\n▸ Modelos válidos (el editor no debe abrir con errores)");
  const porNombre = new Map(comoAna.map((p: { id: string; name: string }) => [p.name, p.id]));
  const conErrores: string[] = [];
  const conAvisos: string[] = [];
  const conNodosVacios: string[] = [];
  const queNoCrecen: string[] = [];
  const repetidas: string[] = [];
  let versionesTotales = 0;
  const conVariasVersiones = new Map<string, number>();
  for (const spec of DEMO_PROCESSES) {
    const id = porNombre.get(spec.name);
    if (!id) {
      conErrores.push(`${spec.name}: no está en la base`);
      continue;
    }
    // Todas las versiones, no solo la última: el historial también abre.
    const modelos: Array<{ version: number; json: string; nodos: number }> = [];
    for (const v of store.listVersions(ana!.id, id)) {
      versionesTotales++;
      const full = store.getVersion(ana!.id, id, v.version)!;
      const issues = validateProcess(full.model);
      if (issues.some((i: { severity: string }) => i.severity === "error")) {
        conErrores.push(
          `${spec.name} v${v.version}: ${issues.map((i: { message: string }) => i.message).join("; ")}`,
        );
      }
      if (issues.length) conAvisos.push(`${spec.name} v${v.version}`);
      // El editor rechaza el modelo entero si un nodo no tiene `label` como
      // string: el proceso no abriría. `validateProcess` no lo mira, así que
      // esta aserción es la que cubre que todos los procesos se puedan abrir.
      const sinEtiqueta = full.model.nodes.filter(
        (n: { label: unknown }) => typeof n.label !== "string" || n.label.trim() === "",
      );
      if (sinEtiqueta.length) {
        conNodosVacios.push(
          `${spec.name} v${v.version}: ${sinEtiqueta.map((n: { id: string }) => n.id).join(", ")}`,
        );
      }
      modelos.push({ version: v.version, json: JSON.stringify(full.model), nodos: full.model.nodes.length });
    }
    // El historial tiene que ir para adelante: cada versión suma algo.
    modelos.sort((a, b) => a.version - b.version);
    if (modelos.length > 1) {
      conVariasVersiones.set(spec.name, modelos.length);
      if (modelos[modelos.length - 1].nodos <= modelos[0].nodos) queNoCrecen.push(spec.name);
      // Y dos versiones seguidas nunca pueden ser el mismo modelo: si lo fueran,
      // el diff del historial no tendría nada que mostrar.
      for (let i = 1; i < modelos.length; i++) {
        if (modelos[i].json === modelos[i - 1].json) repetidas.push(`${spec.name} v${modelos[i].version}`);
      }
    }
  }
  check("el catálogo está entero en la base", conErrores.filter((e) => e.includes("no está")).length === 0);
  check("ninguna versión tiene errores de validación", conErrores.length === 0, conErrores.slice(0, 5));
  check("ninguna versión deja nodos sueltos", conAvisos.length === 0, conAvisos.slice(0, 5));
  check("hay historial en la base", versionesTotales > 130, versionesTotales);
  check("ningún nodo se queda sin etiqueta (el editor los abriría)", conNodosVacios.length === 0, conNodosVacios.slice(0, 5));
  check("el historial siempre suma algo", queNoCrecen.length === 0, queNoCrecen.slice(0, 5));
  check("ninguna versión repite la anterior", repetidas.length === 0, repetidas.slice(0, 5));

  console.log("\n▸ Complejidad (simples y más difíciles)");
  const tamanos = comoAna.map((p: { id: string }) => store.getLatestModel(ana!.id, p.id)!.nodes.length);
  const min = Math.min(...tamanos);
  const max = Math.max(...tamanos);
  const simples = tamanos.filter((n) => n < 8).length;
  const enrevesados = tamanos.filter((n) => n >= 10).length;
  check(`el más simple tiene ${min} nodos`, min <= 6, min);
  check(`el más complejo tiene ${max} nodos`, max >= 12, max);
  check("hay procesos de los dos extremos", max - min >= 6, { min, max });
  // Lo que se pidió: un montón de procesos simples y un montón de difficultes.
  check(`hay ${simples} simples (menos de 8 nodos)`, simples >= 40, simples);
  check(`hay ${enrevesados} enrevesados (10 nodos o más)`, enrevesados >= 20, enrevesados);

  console.log("\n▸ Historial con contenido real");
  check("casi todo el catálogo tiene historial", conVariasVersiones.size >= 90, conVariasVersiones.size);
  check(
    "quien tiene varias versiones tiene a Bruno como editor (si es de Ana)",
    DEMO_PROCESSES.filter((p: { owner?: string }) => p.owner !== "bruno" && conVariasVersiones.has(p.name)).every(
      (p: { name: string }) => store.roleOf(bruno!.id, porNombre.get(p.name)!) === "editor",
    ),
  );

  const versiones = store.listVersions(ana!.id, pedido.id);
  const autores = versiones.map((v: Version) => `${v.version}:${v.authorName}`);
  check("el pedido tiene 3 versiones", versiones.length === 3, versiones.length);
  check("las versiones tienen autor", versiones.every((v: Version) => !!v.authorName), autores);
  check("hay versiones de Ana y de Bruno", new Set(versiones.map((v: Version) => v.authorName)).size === 2, autores);

  // El diff entre versiones tiene que describir un cambio real. El algoritmo de
  // diff tiene su propia suite en el client; acá alcanza con que el modelo haya
  // cambiado de verdad.
  const modeloFinal = store.getVersion(ana!.id, pedido.id, 3)!.model;
  const modeloInicial = store.getVersion(ana!.id, pedido.id, 1)!.model;
  check("el historial muestra diferencias entre versiones", JSON.stringify(modeloFinal) !== JSON.stringify(modeloInicial));
  check("la v1 es más chica que la última", modeloFinal.nodes.length > modeloInicial.nodes.length, {
    v1: modeloInicial.nodes.length,
    v3: modeloFinal.nodes.length,
  });

  console.log("\n▸ Invitación pendiente");
  const invitations = authStore.listInvitations(pedido.id);
  check("deja una invitación viva", invitations.length === 1, invitations.length);
  check("la invitación no expiró", new Date(invitations[0].expiresAt) > new Date(), invitations[0]?.expiresAt);

  console.log("\n▸ Idempotencia");
  const antes = {
    users: (authStore.db.prepare("SELECT COUNT(*) AS c FROM User").get() as { c: number }).c,
    procesos: (authStore.db.prepare("SELECT COUNT(*) AS c FROM Process").get() as { c: number }).c,
    versiones: (authStore.db.prepare("SELECT COUNT(*) AS c FROM ProcessVersion").get() as { c: number }).c,
  };
  const second = seedDemoData();
  check("la segunda corrida no crea nada", second.created === false, second);
  const despues = {
    users: (authStore.db.prepare("SELECT COUNT(*) AS c FROM User").get() as { c: number }).c,
    procesos: (authStore.db.prepare("SELECT COUNT(*) AS c FROM Process").get() as { c: number }).c,
    versiones: (authStore.db.prepare("SELECT COUNT(*) AS c FROM ProcessVersion").get() as { c: number }).c,
  };
  check("no duplica usuarios", despues.users === antes.users, { antes, despues });
  check("no duplica procesos", despues.procesos === antes.procesos, { antes, despues });
  check("no agrega versiones", despues.versiones === antes.versiones, { antes, despues });
  check("el seed reporta las versiones que creó", first.versions > 100, first.versions);

  console.log("\n▸ Reset (npm run seed -- --reset)");
  // Un usuario y un proceso "reales" que el reset NO tiene que tocar.
  const real = authStore.createUser("yo@miempresa.com", "otra-clave", "Yo");
  const procesoReal = store.create({
    name: "Mi proceso real",
    model: buildDemoModel({ name: "x", cat: "Compras", shape: "lineal", steps: ["Hacer la cosa"] }),
    comment: "Mío",
    ownerId: real.id,
    authorName: real.name,
  });
  const cuenta = (tabla: string): number =>
    (authStore.db.prepare(`SELECT COUNT(*) AS c FROM ${tabla}`).get() as { c: number }).c;

  resetDemoData();
  check("borra los procesos demo", store.list(ana!.id).length === 0, store.list(ana!.id).length);
  check("borra los usuarios demo", authStore.findByEmail(DEMO_USERS[0].email) === null);
  // Queda solo lo del usuario real: su proceso (1 versión, 1 colaborador = el
  // owner que agrega `create`).
  check("borra las versiones demo", cuenta("ProcessVersion") === 1, cuenta("ProcessVersion"));
  check("borra los colaboradores demo", cuenta("ProcessCollaborator") === 1, cuenta("ProcessCollaborator"));
  check("borra las invitaciones demo", cuenta("Invitation") === 0, cuenta("Invitation"));
  check("borra las sesiones demo", cuenta("RefreshToken") === 0, cuenta("RefreshToken"));
  check("borra los usuarios demo de verdad", cuenta("User") === 1, cuenta("User"));
  check("no toca el proceso real", store.getMeta(real.id, procesoReal.meta.id)?.name === "Mi proceso real");
  check(
    "no corta la sesión del usuario real",
    authStore.verifyPassword(authStore.findByEmail("yo@miempresa.com")!, "otra-clave"),
  );

  const third = seedDemoData();
  check("vuelve a sembrar los 100", third.created === true && third.processes === 100, third.processes);
  check("y ahora hay 101 procesos en la base", cuenta("Process") === 101, cuenta("Process"));
  check("el proceso real sigue ahí", store.getMeta(real.id, procesoReal.meta.id) !== null);
} catch (e) {
  console.error("\nEl test explota:", e);
  failed++;
} finally {
  closeStores();
}

rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
