/**
 * Datos de demostración para desarrollo local (Fase 4).
 *
 * Siembra dos usuarios conocidos y **100 procesos de negocio** repartidos en
 * 12 áreas (personas, contratación, compras, inventario, ventas, logística,
 * servicio al cliente, calidad, finanzas, legal, tecnología y salud), con
 * colaboradores de los tres roles, historiales de hasta 4 versiones con autores
 * alternados e invitaciones pendientes.
 *
 * Los procesos salen del catálogo de `demoProcesses.ts`: cada uno declara sus
 * pasos y su forma (lineal, con corrección, con aprobaciones, con ramas en
 * paralelo o compuesto) y el constructor arma el grafo, así que todos son
 * válidos y ninguno se parece a "Proceso 37".
 *
 * Es **idempotente**: si los usuarios demo ya existen no hace nada, así que se
 * puede correr `npm run seed` las veces que haga falta sin duplicar datos ni
 * pisar el trabajo real. `npm run seed -- --reset` borra solo los datos demo
 * (sus procesos, versiones, colaboradores, invitaciones y tokens) y vuelve a
 * sembrar, sin tocar el archivo de la base ni el trabajo real de otros usuarios.
 */
import type { ProcessModel } from "../../../shared/src/model/types.js";
import { DEMO_PROCESSES, buildDemoModel, type DemoProcessSpec, type DemoShape } from "./demoProcesses.js";
import { getAuthStore, getProcessStore } from "./singleton.js";

/** Contraseña de todos los usuarios demo (mismo para todos, es un seed local). */
export const DEMO_PASSWORD = "demo1234";

/** Usuarios demo que crea el seed, con el rol que tienen sobre los procesos. */
export const DEMO_USERS = [
  { email: "ana@demo.local", name: "Ana", role: "owner" },
  { email: "bruno@demo.local", name: "Bruno", role: "editor" },
] as const;

/** Resultado del seed, para que el CLI pueda informar. */
export interface SeedResult {
  /** `false` si ya había datos demo y no se tocó nada. */
  created: boolean;
  users: Array<{ email: string; name: string; role: string }>;
  processes: number;
  versions: number;
  invitations: number;
  /** Procesos por área, para que el CLI pueda mostrar el reparto. */
  categories: Array<{ category: string; count: number }>;
}

/** Cuántos procesos hay de cada área y de cada forma (para el informe). */
export function demoCatalogSummary(): {
  total: number;
  categories: Array<{ category: string; count: number }>;
  shapes: Array<{ shape: string; count: number }>;
} {
  const byCat = new Map<string, number>();
  const byShape = new Map<string, number>();
  for (const spec of DEMO_PROCESSES) {
    byCat.set(spec.cat, (byCat.get(spec.cat) ?? 0) + 1);
    byShape.set(spec.shape, (byShape.get(spec.shape) ?? 0) + 1);
  }
  return {
    total: DEMO_PROCESSES.length,
    categories: [...byCat].map(([category, count]) => ({ category, count })),
    shapes: [...byShape].map(([shape, count]) => ({ shape, count })),
  };
}

// --- Historial: de la forma más simple a la más compleja ------------------

/** Las formas ordenadas de menos a más enrevesada. */
const SHAPE_ORDER: DemoShape[] = ["lineal", "revision", "aprobacion", "paralelo", "compuesto"];

/** Qué le agrega cada forma al diagrama (para el comentario de la versión). */
const PHRASE: Record<DemoShape, string> = {
  lineal: "el flujo lineal",
  revision: "el camino de corrección",
  aprobacion: "la cadena de aprobaciones",
  paralelo: "un bloque en paralelo",
  compuesto: "las fases con escalamiento",
};

/**
 * Una forma se puede construir solo si el proceso declara los datos que pide
 * (decisiones, ramas en paralelo, suficientes pasos). Un proceso lineal no tiene
 * decisiones, así que su historial no puede "sumar la cadena de aprobaciones":
 * mejor quedarse con lo que tiene que mostrar un cambio real.
 */
function canBuild(spec: DemoProcessSpec, shape: DemoShape): boolean {
  const decisiones = spec.d?.length ?? 0;
  const ramas = spec.par?.length ?? 0;
  switch (shape) {
    case "lineal":
      return spec.steps.length >= 1;
    case "revision":
    case "aprobacion":
      return decisiones > 0 && spec.steps.length >= 1;
    case "paralelo":
      return decisiones > 0 && ramas > 0 && spec.steps.length >= 2;
    case "compuesto":
      return decisiones >= 3 && ramas > 0 && spec.steps.length >= 4;
  }
}

/** Los pasos que necesita cada forma como mínimo. */
const MIN_STEPS: Record<DemoShape, number> = {
  lineal: 1,
  revision: 1,
  aprobacion: 1,
  paralelo: 2,
  compuesto: 4,
};

/** Una versión del historial: qué forma tiene y cuántos pasos muestra. */
interface DemoVersion {
  shape: DemoShape;
  steps: number;
}

/**
 * El historial de un proceso: `versions` etapas, de la más simple a **la forma
 * que declara el catálogo** (el estado actual siempre es el bueno).
 *
 * Cada etapa suma algo de verdad: primero crecen los pasos y después se suman
 * las decisiones y las ramas en paralelo. Por eso dos versiones consecutivas
 * nunca quedan iguales, que es lo que hace que el diff del historial tenga algo
 * que mostrar.
 */
function historyFor(spec: DemoProcessSpec, versions: number): DemoVersion[] {
  // Cuántas etapas de forma distintas tenemos; si el proceso no declara datos
  // para tantas, se repite la final y el cambio lo aportan los pasos.
  const candidates = SHAPE_ORDER.filter((shape) => canBuild(spec, shape));
  if (!candidates.includes(spec.shape)) candidates.push(spec.shape);
  const last = candidates.indexOf(spec.shape);
  const etapasDeForma = Math.min(versions, last + 1);
  const shapes = candidates.slice(last - etapasDeForma + 1, last + 1);
  while (shapes.length < versions) shapes.push(spec.shape);

  // Los pasos crecen de a uno por versión hasta el total, sin pasarse.
  const total = spec.steps.length;
  const salto = Math.max(1, Math.ceil(total / versions));
  const usados: number[] = [];
  for (let i = 0; i < versions; i++) {
    usados.push(Math.min(total, usados.length === 0 ? salto : usados[usados.length - 1] + salto));
  }

  return shapes.map((shape, i) => ({
    shape,
    steps: Math.max(Math.min(MIN_STEPS[shape], total), usados[i] ?? total),
  }));
}

/** Comentario de una versión: qué se agregó respecto de la anterior. */
function versionComment(v: DemoVersion, first: boolean, grewSteps: boolean): string {
  if (first) return "Versión inicial";
  return grewSteps ? "Suma los pasos que faltaban" : `Agrega ${PHRASE[v.shape]}`;
}

/** Un modelo por versión del historial. */
function versionModels(spec: DemoProcessSpec, history: DemoVersion[]): ProcessModel[] {
  return history.map((v) => buildDemoModel({ ...spec, shape: v.shape, steps: spec.steps.slice(0, v.steps) }));
}

/** Siembra los datos demo. Idempotente: corre las veces que quieras. */
export function seedDemoData(): SeedResult {
  const authStore = getAuthStore();
  const store = getProcessStore();

  const [first] = DEMO_USERS;
  const alreadySeeded = authStore.findByEmail(first.email) !== null;
  if (alreadySeeded) {
    return {
      created: false,
      users: DEMO_USERS.map((u) => ({ ...u })),
      processes: store.list(first.email).length,
      versions: 0,
      invitations: 0,
      categories: demoCatalogSummary().categories,
    };
  }

  const ana = authStore.createUser(DEMO_USERS[0].email, DEMO_PASSWORD, DEMO_USERS[0].name);
  const bruno = authStore.createUser(DEMO_USERS[1].email, DEMO_PASSWORD, DEMO_USERS[1].name);
  const people = { ana, bruno };

  let versionCount = 0;
  const created: Array<{ id: string; versions: number; invitation: boolean }> = [];

  DEMO_PROCESSES.forEach((spec) => {
    const history = historyFor(spec, Math.min(4, Math.max(1, spec.versions ?? 1)));
    const models = versionModels(spec, history);
    const versions = models.length;
    const owner = people[spec.owner ?? "ana"];

    const first = store.create({
      name: spec.name,
      model: models[0],
      comment: versionComment(history[0], true, false),
      ownerId: owner.id,
      authorName: owner.name,
    });
    const processId = first.meta.id;
    versionCount += 1;

    // Colaboradores ANTES de las versiones: las versiones siguientes se turnan
    // entre los dos usuarios, y quien firma tiene que poder guardar de verdad.
    const brunoRole = spec.bruno ?? (versions > 1 && owner.id === ana.id ? "editor" : undefined);
    if (brunoRole) store.addCollaborator(owner.id, processId, bruno.id, brunoRole);

    const anaRole = spec.ana ?? (owner.id === bruno.id && versions > 1 ? "editor" : undefined);
    if (anaRole) store.addCollaborator(owner.id, processId, ana.id, anaRole);

    for (let v = 1; v < models.length; v++) {
      const author = v % 2 === 1 ? bruno : ana;
      store.update(author.id, processId, {
        model: models[v],
        comment: versionComment(history[v], false, history[v].steps !== history[v - 1].steps),
        authorName: author.name,
      });
      versionCount += 1;
    }

    created.push({ id: processId, versions, invitation: spec.invitation === true });
  });

  // Invitaciones vivas a alguien que todavía no se registró: se ven en
  // "Compartir" y se pueden aceptar desde /invitaciones.
  let invitations = 0;
  for (const p of created) {
    if (!p.invitation) continue;
    authStore.createInvitation("pendiente@ejemplo.local", p.id, "viewer", ana);
    invitations += 1;
  }

  return {
    created: true,
    users: DEMO_USERS.map((u) => ({ ...u })),
    processes: created.length,
    versions: versionCount,
    invitations,
    categories: demoCatalogSummary().categories,
  };
}

/**
 * Borra **solo** los datos de los usuarios demo y sus procesos, para volver a
 * sembrar desde cero. No toca el archivo de la base (así el server que esté
 * corriendo la ve cambiar al instante) ni los datos de otros usuarios.
 */
export function resetDemoData(): void {
  const authStore = getAuthStore();
  const db = authStore.db;
  const emails = DEMO_USERS.map((u) => u.email);
  const inList = emails.map(() => "?").join(", ");
  const userIds = `SELECT id FROM User WHERE email IN (${inList})`;

  db.exec("BEGIN");
  try {
    // Primero los procesos: desde ahí cuelgan versiones, colaboradores e
    // invitaciones (CASCADE), y desde los usuarios, los refresh tokens.
    db.prepare(`DELETE FROM Process WHERE ownerId IN (${userIds})`).run(...emails);
    db.prepare(
      `DELETE FROM Process WHERE id IN (SELECT processId FROM ProcessCollaborator WHERE userId IN (${userIds}))`,
    ).run(...emails);
    db.prepare(`DELETE FROM User WHERE email IN (${inList})`).run(...emails);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
