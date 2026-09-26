/**
 * Tests de unidad del `ProcessStore` (Fase 4).
 *
 * Cubren lo que el e2e no alcanza a ver:
 *  - la autoría desnormalizada de cada versión (`authorName`),
 *  - la semántica de la caché de roles dentro de un mismo scope (que una
 *    mutación de permisos no deje un valor viejo cacheado),
 *  - que `list()` resuelva todo en **una** query (regresión del N+1).
 *
 * Corre contra `dist/` con `npm --prefix server run test:unit`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAuthStore } from "../dist/server/src/db/authStore.js";
import { createStore, type ProcessStore } from "../dist/server/src/db/processStore.js";
import { runWithRoleCache } from "../dist/server/src/db/roleCache.js";

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

const model = (n: number) => ({
  version: 1,
  nodes: Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    kind: "task",
    label: `Nodo ${i}`,
    position: { x: i * 100, y: 0 },
    props: {},
  })),
  edges: [],
});

/** Cuenta los SELECT ejecutados sobre el `DatabaseSync` interno del store. */
function countSelects(store: ProcessStore): { count: () => number } {
  // `db` es `private` en TypeScript pero es una propiedad normal en runtime:
  // este test es blanco a propósito para poder observar las queries.
  const db = (store as unknown as { db: { setAuthorizer(cb: (action: number) => number): void } }).db;
  let selects = 0;
  const SQLITE_SELECT = 21;
  const SQLITE_OK = 0;
  db.setAuthorizer((action) => {
    if (action === SQLITE_SELECT) selects++;
    return SQLITE_OK;
  });
  return { count: () => selects };
}

const tmp = mkdtempSync(join(tmpdir(), "react-bpmn-unit-"));
const dbFile = join(tmp, "test.db");

// El AuthStore crea el esquema (incluida la tabla User) que el ProcessStore
// necesita por las foreign keys.
const authStore = createAuthStore(dbFile);
const store = createStore(dbFile);

try {
  console.log("\n▸ Autoría de versiones");
  const ana = authStore.createUser("ana@test.com", "password123", "Ana");
  const bruno = authStore.createUser("bruno@test.com", "password123", "Bruno");

  const created = store.create({ name: "Pedido", model: model(2), ownerId: ana.id, authorName: ana.name });
  const pid = created.meta.id;

  let versions = store.listVersions(ana.id, pid);
  check("la v1 registra a su autor", versions[0].authorId === ana.id && versions[0].authorName === "Ana", versions[0]);

  store.update(ana.id, pid, { comment: "agrego un nodo" });
  store.update(ana.id, pid, { comment: "otra vez" });
  versions = store.listVersions(ana.id, pid);
  check("las 3 versiones tienen autor", versions.length === 3 && versions.every((v) => v.authorName === "Ana"), versions);

  const one = store.getVersion(ana.id, pid, 1);
  check("GET de una versión incluye el autor", one?.authorName === "Ana" && one?.authorId === ana.id, one);

  // Sin `authorName` (llamada directa al store) lo resuelve desde `User` en vez
  // de dejar la versión a medias con `authorId` pero sin nombre.
  const noAuthor = store.create({ name: "Sin autor", model: model(1), ownerId: ana.id });
  const noAuthorV1 = store.getVersion(ana.id, noAuthor.meta.id, 1);
  check("si el autor no viene, se resuelve desde User", noAuthorV1?.authorName === "Ana", noAuthorV1);

  console.log("\n▸ Caché de roles");
  const cached = runWithRoleCache(() => {
    const first = store.roleOf(ana.id, pid);
    const second = store.roleOf(ana.id, pid);
    // Bruno arranca sin acceso: el null también se cachea.
    const brunoBefore = store.roleOf(bruno.id, pid);
    // Alta directa (= aceptar una invitación) dentro del mismo scope.
    store.addCollaboratorDirect(pid, bruno.id, "editor");
    const brunoAfter = store.roleOf(bruno.id, pid);
    // Y la baja, también dentro del mismo scope.
    store.removeCollaborator(ana.id, pid, bruno.id);
    const brunoFinal = store.roleOf(bruno.id, pid);
    return { first, second, brunoBefore, brunoAfter, brunoFinal };
  });

  check("el owner se resuelve como owner", cached.first === "owner" && cached.second === "owner", cached);
  check("sin colaboración el rol es null", cached.brunoBefore === null);
  check("tras el alta, el mismo scope ya ve el rol nuevo", cached.brunoAfter === "editor", cached);
  check("tras la baja, el mismo scope ya ve el null", cached.brunoFinal === null, cached);

  // Fuera de un scope no hay caché: sigue consultando la DB.
  store.addCollaboratorDirect(pid, bruno.id, "viewer");
  check("fuera del scope el rol se lee fresco", store.roleOf(bruno.id, pid) === "viewer");
  check("list() marca a cada uno con su rol", (() => {
    const forAna = store.list(ana.id).find((p) => p.id === pid);
    const forBruno = store.list(bruno.id).find((p) => p.id === pid);
    return forAna?.role === "owner" && forBruno?.role === "viewer";
  })());

  console.log("\n▸ Consultas (regresión del N+1)");
  // El authorizer autoriza una vez por sentencia (y una vez por subconsulta),
  // no por fila. Por eso la regresión se mide comparando el conteo con 2
  // procesos contra el de 20: si `list()` volviera a consultar por proceso
  // (el N+1 que se corrigió), el segundo número se multiplicaría por 10.
  const counterTwo = countSelects(store);
  const rowsTwo = store.list(ana.id);
  const selectsTwo = counterTwo.count();

  for (let i = 0; i < 18; i++) {
    store.create({ name: `Extra ${i}`, model: model(1), ownerId: ana.id, authorName: "Ana" });
  }

  const counterMany = countSelects(store);
  const rowsMany = store.list(ana.id);
  const selectsMany = counterMany.count();

  check(
    `list() no crece con la cantidad de procesos (${rowsTwo.length} → ${rowsMany.length})`,
    selectsMany === selectsTwo,
    { selectsTwo, selectsMany },
  );
  // 1 SELECT principal + 2 subconsultas (versionCount y modelo último).
  check("list() es una sola sentencia", selectsTwo === 3, { selectsTwo });

  const metaCounter = countSelects(store);
  store.getMeta(ana.id, pid);
  // 1 sentencia de rol + la de metadatos (con sus 2 subconsultas).
  check("getMeta() son 2 sentencias (rol + fila)", metaCounter.count() === 4, {
    selects: metaCounter.count(),
  });

  const versionCounter = countSelects(store);
  store.listVersions(ana.id, pid);
  check("listVersions() son 2 sentencias (permiso + filas)", versionCounter.count() === 2, {
    selects: versionCounter.count(),
  });

  console.log("\n▸ Metadatos derivados");
  const meta = store.list(ana.id).find((p) => p.id === pid)!;
  check("versionCount cuenta las 3 versiones", meta.versionCount === 3, meta);
  check("el preview sale del modelo de la última versión", meta.preview === "2 nodos, 0 aristas", meta.preview);
  check("el status es válido", meta.status === "válido", meta.status);

  const empty = store.create({ name: "Vacío", model: model(0), ownerId: ana.id });
  const emptyMeta = store.getMeta(ana.id, empty.meta.id)!;
  check("un proceso sin nodos queda como vacío", emptyMeta.status === "vacío" && emptyMeta.preview === "0 nodos, 0 aristas", emptyMeta);
} catch (e) {
  console.error("\nEl test explota:", e);
  failed++;
} finally {
  store.close();
  authStore.close();
}

rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
