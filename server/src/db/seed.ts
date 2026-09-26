/**
 * Datos de demostración para desarrollo local (Fase 4).
 *
 * Crea dos usuarios conocidos, procesos ya armados con varias versiones y
 * colaboradores de ambos roles, para poder recorrer la app sin registrar nada:
 * owner, editor y viewer, historial con distintos autores e invitación pendiente.
 *
 * Es **idempotente**: si los usuarios demo ya existen no hace nada, así que se
 * puede correr `npm run seed` las veces que haga falta sin duplicar datos ni
 * pisar el trabajo real.
 */
import type { ProcessModel, ProcessNode, ProcessEdge } from "../../../shared/src/model/types.js";
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
}

const node = (
  id: string,
  kind: ProcessNode["kind"],
  label: string,
  x: number,
  y = 0,
  props: ProcessNode["props"] = {},
): ProcessNode => ({
  id,
  kind,
  label,
  position: { x, y },
  props,
});

const edge = (id: string, source: string, target: string): ProcessEdge => ({ id, source, target });

/** v1: el pedido entra, alguien lo revisa y termina. */
const PEDIDO_V1: ProcessModel = {
  version: 1,
  nodes: [
    node("n1", "start", "Inicio", 0),
    node("n2", "task", "Revisar pedido", 160, 0, { description: "Verificar stock y precio" }),
    node("n3", "end", "Fin", 320),
  ],
  edges: [edge("e1", "n1", "n2"), edge("e2", "n2", "n3")],
};

/** v2: se agrega la decisión de aprobación (guardada por Bruno). */
const PEDIDO_V2: ProcessModel = {
  version: 1,
  nodes: [
    ...PEDIDO_V1.nodes,
    node("n4", "decision", "¿Aprobado?", 160, 140),
  ],
  edges: [
    edge("e1", "n1", "n2"),
    edge("e3", "n2", "n4"),
    edge("e4", "n4", "n3"),
  ],
};

/** v3: la tarea se renombra y se notifica antes de terminar (guardada por Ana). */
const PEDIDO_V3: ProcessModel = {
  version: 1,
  nodes: [
    ...PEDIDO_V2.nodes,
    node("n5", "task", "Notificar", 320, 140, { assignee: "Almacén" }),
  ],
  edges: [
    edge("e1", "n1", "n2"),
    edge("e3", "n2", "n4"),
    edge("e5", "n4", "n5"),
    edge("e6", "n5", "n3"),
  ],
};

/** Proceso simple donde Bruno es solo viewer (para ver el modo lectura). */
const PRESUPUESTO_V1: ProcessModel = {
  version: 1,
  nodes: [
    node("n1", "start", "Solicitud", 0),
    node("n2", "task", "Validar monto", 160),
    node("n3", "end", "Fin", 320),
  ],
  edges: [edge("e1", "n1", "n2"), edge("e2", "n2", "n3")],
};

/**
 * Siembra los datos demo. Idempotente: corre las veces que quieras.
 */
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
    };
  }

  const ana = authStore.createUser(DEMO_USERS[0].email, DEMO_PASSWORD, DEMO_USERS[0].name);
  const bruno = authStore.createUser(DEMO_USERS[1].email, DEMO_PASSWORD, DEMO_USERS[1].name);

  // Proceso 1: historial de 3 versiones con dos autores distintos.
  const pedido = store.create({
    name: "Pedido de compra",
    model: PEDIDO_V1,
    comment: "Versión inicial",
    ownerId: ana.id,
    authorName: ana.name,
  });
  const pedidoId = pedido.meta.id;

  store.addCollaborator(ana.id, pedidoId, bruno.id, "editor");
  store.update(bruno.id, pedidoId, {
    model: PEDIDO_V2,
    comment: "Agrega la decisión de aprobación",
    authorName: bruno.name,
  });
  store.update(ana.id, pedidoId, {
    model: PEDIDO_V3,
    comment: "Notifica antes de cerrar",
    authorName: ana.name,
  });

  // Proceso 2: Bruno solo lee.
  const presupuesto = store.create({
    name: "Aprobación de presupuesto",
    model: PRESUPUESTO_V1,
    comment: "Versión inicial",
    ownerId: ana.id,
    authorName: ana.name,
  });
  store.addCollaborator(ana.id, presupuesto.meta.id, bruno.id, "viewer");

  // Invitación viva a alguien que todavía no se registró: se ve en "Compartir".
  authStore.createInvitation("pendiente@ejemplo.local", pedidoId, "viewer", ana);

  return {
    created: true,
    users: DEMO_USERS.map((u) => ({ ...u })),
    processes: 2,
  };
}
