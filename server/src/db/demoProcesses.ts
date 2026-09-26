/**
 * Catálogo de procesos de demostración (100).
 *
 * No son 100 archivos ni 100 modelos escritos a mano: es un **catálogo** de
 * nombres, pasos y decisiones reales de negocio, más un constructor que arma el
 * grafo según la "forma" del proceso. Así cada modelo sale bien conectado por
 * construcción y todos los nombres dicen algo (contratación, inventario,
 * ventas…), en vez de "Proceso 37".
 *
 * Formas disponibles (de la más simple a la más enrevesada):
 * - `lineal`:    Inicio → pasos → Fin.
 * - `revision`:  un desvío "no" que corrige y vuelve al primer paso.
 * - `aprobacion`: cadena de decisiones con vuelta atrás.
 * - `paralelo`:  un "sí" abre ramas en paralelo que vuelven a converger.
 * - `compuesto`: paralelo + dos correcciones + escalamiento (el más difícil).
 */
import type { ProcessEdge, ProcessModel, ProcessNode } from "../../../shared/src/model/types.js";

export const DEMO_CATEGORIES = [
  "Personas",
  "Contratación",
  "Compras",
  "Inventario",
  "Ventas",
  "Logística",
  "Servicio al cliente",
  "Calidad",
  "Finanzas",
  "Legal",
  "Tecnología",
  "Salud",
] as const;
export type DemoCategory = (typeof DEMO_CATEGORIES)[number];

export const DEMO_SHAPES = ["lineal", "revision", "aprobacion", "paralelo", "compuesto"] as const;
export type DemoShape = (typeof DEMO_SHAPES)[number];

/** Un proceso del catálogo, con lo necesario para armar su modelo. */
export interface DemoProcessSpec {
  name: string;
  cat: DemoCategory;
  shape: DemoShape;
  /** Etiquetas de las tareas, en orden. */
  steps: string[];
  /** Etiquetas de las decisiones (una por "sí/no"). */
  d?: string[];
  /** Ramas del bloque en paralelo. */
  par?: string[];
  /** Tarea donde convergen las ramas. */
  merge?: string;
  /** Tarea del camino "no" (corregir / devolver / completar). */
  loop?: string;
  /** Tarea del camino "no" que escala a otro nivel. */
  escalate?: string;
  /** Tarea final antes del Fin. */
  archive?: string;
  /** Cuántas versiones guarda (1 = solo la inicial). */
  versions?: number;
  /** Rol de Bruno si es colaborador. */
  bruno?: "editor" | "viewer";
  /** Dueño del proceso (por defecto Ana). */
  owner?: "ana" | "bruno";
  /** Rol de Ana si el dueño es Bruno. */
  ana?: "editor" | "viewer";
  /** Deja una invitación pendiente a un usuario que no se registró. */
  invitation?: boolean;
}

// --- Constructor de grafos -------------------------------------------------

const STEP_X = 180;

class Builder {
  readonly nodes: ProcessNode[] = [];
  readonly edges: ProcessEdge[] = [];
  private counter = 0;

  add(kind: ProcessNode["kind"], label: string, x: number, y: number): string {
    const id = `n${++this.counter}`;
    this.nodes.push({ id, kind, label, position: { x, y }, props: {} });
    return id;
  }

  link(source: string, target: string, label?: string): void {
    this.edges.push(
      label === undefined
        ? { id: `e${this.edges.length + 1}`, source, target }
        : { id: `e${this.edges.length + 1}`, source, target, label },
    );
  }

  model(): ProcessModel {
    return { version: 1, nodes: this.nodes, edges: this.edges };
  }
}

/** Inicio y Fin de todos los procesos (misma convención en toda la app). */
function extremities(b: Builder, startX: number, endX: number): { start: string; end: string } {
  return {
    start: b.add("start", "Inicio", startX, 0),
    end: b.add("end", "Fin", endX, 0),
  };
}

/** Etiquetas de los caminos de una decisión, por defecto "Sí" / "No". */
const YES = "Sí";
const NO = "No";

function buildLineal(spec: DemoProcessSpec): ProcessModel {
  const b = new Builder();
  const { start, end } = extremities(b, 0, STEP_X * (spec.steps.length + 1));

  let prev = start;
  spec.steps.forEach((label, i) => {
    const id = b.add("task", label, STEP_X * (i + 1), 0);
    b.link(prev, id);
    prev = id;
  });
  b.link(prev, end);
  return b.model();
}

function buildRevision(spec: DemoProcessSpec): ProcessModel {
  const b = new Builder();
  const { start, end } = extremities(b, 0, STEP_X * (spec.steps.length + 2));
  const [question] = spec.d ?? ["¿Está completo?"];
  const loop = spec.loop ?? "Corregir y reenviar";

  // steps[0] → decisión → (sí) el resto de los pasos → Fin
  //                    → (no) corregir → vuelve a steps[0]
  const first = b.add("task", spec.steps[0], STEP_X, 0);
  const decision = b.add("decision", question, STEP_X * 2, 0);
  const correct = b.add("task", loop, STEP_X * 2 + 40, 200);
  b.link(start, first);
  b.link(first, decision);
  b.link(decision, correct, NO);
  b.link(correct, first);

  let prev = decision;
  for (let i = 1; i < spec.steps.length; i++) {
    const id = b.add("task", spec.steps[i], STEP_X * (i + 2), 0);
    b.link(prev, id, YES);
    prev = id;
  }
  b.link(prev, end);
  return b.model();
}

function buildAprobacion(spec: DemoProcessSpec): ProcessModel {
  const b = new Builder();
  const questions = spec.d ?? ["¿Está aprobado?", "¿Autoriza la dirección?"];
  const archive = spec.archive ?? "Notificar y archivar";
  const loop = spec.loop ?? "Devolver para ajustes";

  // Inicio → paso → decisión → (sí) siguiente decisión → archivar → Fin.
  // Cada "no" vuelve al primer paso, así que todos los caminos llegan al Fin.
  const { start, end } = extremities(b, 0, STEP_X * (questions.length + 3));

  const first = b.add("task", spec.steps[0], STEP_X, 0);
  b.link(start, first);

  let prev: string = first;
  questions.forEach((question, i) => {
    const x = STEP_X * (i + 2);
    const decision = b.add("decision", question, x, 0);
    const back = b.add("task", loop, x + 40, 220 + i * 120);
    b.link(prev, decision);
    b.link(decision, back, NO);
    b.link(back, first);
    prev = decision;
  });

  const close = b.add("task", archive, STEP_X * (questions.length + 2), 0);
  b.link(prev, close, YES);
  b.link(close, end);
  return b.model();
}

function buildParalelo(spec: DemoProcessSpec): ProcessModel {
  const b = new Builder();
  const branches = spec.par ?? ["Rama A", "Rama B"];
  const merge = spec.merge ?? "Consolidar resultados";
  const { start, end } = extremities(b, 0, STEP_X * (spec.steps.length + 3));
  const [question] = spec.d ?? ["¿Requiere trabajo en paralelo?"];

  const first = b.add("task", spec.steps[0], STEP_X, 0);
  const decision = b.add("decision", question, STEP_X * 2, 0);
  b.link(start, first);
  b.link(first, decision);

  // "Sí": las ramas salen todas del mismo nodo y vuelven a converger.
  const spread = branches.length;
  const mergeId = b.add("task", merge, STEP_X * 3 + 60, 0);
  branches.forEach((label, i) => {
    const y = (i - (spread - 1) / 2) * 140;
    const id = b.add("task", label, STEP_X * 3, y);
    b.link(decision, id, YES);
    b.link(id, mergeId);
  });

  // "No": sigue derecho, sin pasar por la consolidación.
  let prev = decision;
  for (let i = 1; i < spec.steps.length; i++) {
    const id = b.add("task", spec.steps[i], STEP_X * (i + 2), 200);
    b.link(prev, id, NO);
    prev = id;
  }

  const afterMerge = b.add("task", spec.steps[spec.steps.length - 1], STEP_X * 4 + 60, 0);
  b.link(mergeId, afterMerge);
  b.link(prev, afterMerge);
  b.link(afterMerge, end);
  return b.model();
}

function buildCompuesto(spec: DemoProcessSpec): ProcessModel {
  const b = new Builder();
  const questions = spec.d ?? [
    "¿Se cumple el requisito principal?",
    "¿Está completa la documentación?",
    "¿Se aprueba el cierre?",
  ];
  const branches = spec.par ?? ["Rama A", "Rama B"];
  const merge = spec.merge ?? "Consolidar resultados";
  const loop = spec.loop ?? "Corregir y reenviar";
  const escalate = spec.escalate ?? "Escalar a segundo nivel";
  const archive = spec.archive ?? "Notificar y archivar";
  const { start, end } = extremities(b, 0, STEP_X * 12);

  // Fase 1: requisito + fan-out en paralelo que vuelve a converger.
  const s0 = b.add("task", spec.steps[0], STEP_X, 0);
  const d1 = b.add("decision", questions[0], STEP_X * 2, 0);
  const up = b.add("task", escalate, STEP_X * 2 + 40, 200);
  b.link(start, s0);
  b.link(s0, d1);
  b.link(d1, up, NO);
  b.link(up, s0);

  const mergeId = b.add("task", merge, STEP_X * 4, 0);
  branches.forEach((label, i) => {
    const y = (i - (branches.length - 1) / 2) * 140;
    const id = b.add("task", label, STEP_X * 3, y);
    b.link(d1, id, YES);
    b.link(id, mergeId);
  });

  // Fase 2: corrección documental en línea.
  const s1 = b.add("task", spec.steps[1], STEP_X * 5, 0);
  const d2 = b.add("decision", questions[1], STEP_X * 6, 0);
  const fix = b.add("task", loop, STEP_X * 6 + 40, 200);
  b.link(mergeId, s1);
  b.link(s1, d2);
  b.link(d2, fix, NO);
  b.link(fix, s1);

  // Fase 3: ejecución y cierre con vuelta atrás. El cuarto paso es
  // opcional: si el proceso no lo declara, la fase cierra con la decisión
  // sola. Un nodo con la etiqueta `undefined` haría que el editor rechazara
  // el modelo entero (y el proceso no se podría abrir).
  const s2 = b.add("task", spec.steps[2], STEP_X * 7, 0);
  const s3 = spec.steps[3] ? b.add("task", spec.steps[3], STEP_X * 8, 0) : s2;
  const d3 = b.add("decision", questions[2], STEP_X * 9, 0);
  const back = b.add("task", spec.loop ?? "Devolver para ajustes", STEP_X * 9 + 40, 200);
  b.link(d2, s2, YES);
  if (s3 !== s2) b.link(s2, s3);
  b.link(s3, d3);
  b.link(d3, back, NO);
  b.link(back, s2);

  const close = b.add("task", archive, STEP_X * 10, 0);
  b.link(d3, close, YES);
  b.link(close, end);
  return b.model();
}

/** Arma el modelo del proceso según su forma. */
export function buildDemoModel(spec: DemoProcessSpec): ProcessModel {
  switch (spec.shape) {
    case "lineal":
      return buildLineal(spec);
    case "revision":
      return buildRevision(spec);
    case "aprobacion":
      return buildAprobacion(spec);
    case "paralelo":
      return buildParalelo(spec);
    case "compuesto":
      return buildCompuesto(spec);
  }
}

// --- Catálogo --------------------------------------------------------------
// eslint-disable-next-line
export const DEMO_PROCESSES: DemoProcessSpec[] = [
  // --- Personas (12) ---
  {
    name: "Alta de empleado",
    cat: "Personas",
    shape: "revision",
    steps: ["Cargar la documentación", "Validar antecedentes laborales", "Firmar el contrato de trabajo"],
    d: ["¿Los antecedentes están completos?"],
    loop: "Corregir la documentación",
    versions: 3,
    bruno: "editor",
  },
  {
    name: "Solicitud de vacaciones",
    cat: "Personas",
    shape: "lineal",
    steps: ["Enviar la solicitud", "Validar el saldo de días", "Aprobación del responsable", "Registrar en el sistema"],
    versions: 2,
    bruno: "editor",
  },
  {
    name: "Proceso de onboarding",
    cat: "Personas",
    shape: "compuesto",
    steps: [
      "Preparar la estación de trabajo",
      "Entregar equipo y credenciales",
      "Capacitación inicial",
      "Asignar objetivos del trimestre",
    ],
    d: ["¿El puesto está listo?", "¿La capacitación fue aprobada?", "¿Se cierra el onboarding?"],
    par: ["Entregar notebook", "Habilitar accesos a sistemas"],
    merge: "Confirmar el alta del colaborador",
    loop: "Completar documentación faltante",
    escalate: "Escalar a Recursos Humanos",
    archive: "Archivar el legajo de ingreso",
    versions: 4,
    bruno: "editor",
  },
  {
    name: "Evaluación de desempeño",
    cat: "Personas",
    shape: "aprobacion",
    steps: ["Autoevaluación del colaborador", "Evaluación del responsable", "Revisión de Recursos Humanos"],
    d: ["¿La evaluación está completa?", "¿Requiere comité de calibración?"],
    archive: "Notificar el resultado y archivar",
    versions: 2,
    bruno: "editor",
  },
  {
    name: "Contratación de personal temporal",
    cat: "Personas",
    shape: "revision",
    steps: ["Definir el perfil del puesto", "Publicar la oferta", "Filtrar postulaciones", "Realizar entrevistas"],
    d: ["¿Hay candidatos preseleccionados?"],
    loop: "Ampliar la búsqueda",
    versions: 2,
  },
  {
    name: "Sanción disciplinaria",
    cat: "Personas",
    shape: "aprobacion",
    steps: ["Notificar el incumplimiento", "Escuchar al colaborador", "Redactar el acta", "Definir la sanción"],
    d: ["¿El acta está firmada?", "¿La sanción supera una amonestación?"],
    archive: "Notificar la sanción y archivar el acta",
    versions: 2,
  },
  {
    name: "Renuncia laboral",
    cat: "Personas",
    shape: "lineal",
    steps: ["Recibir la carta de renuncia", "Calcular la liquidación final", "Devolver activos de la empresa", "Archivar el legajo"],
    versions: 2,
  },
  {
    name: "Transferencia interna de personal",
    cat: "Personas",
    shape: "revision",
    steps: ["Solicitar el traslado", "Avalar el traslado", "Actualizar la liquidación", "Comunicar al equipo nuevo"],
    d: ["¿Hay vacante en el área de destino?"],
    loop: "Buscar otra vacante disponible",
    versions: 2,
  },
  {
    name: "Plan de capacitación",
    cat: "Personas",
    shape: "paralelo",
    steps: ["Detectar la necesidad de capacitación", "Inscribir al colaborador", "Medir el impacto"],
    d: ["¿Requiere formación externa?"],
    par: ["Curso interno", "Curso externo con proveedor"],
    merge: "Consolidar el plan de formación",
    versions: 2,
  },
  {
    name: "Control de asistencia",
    cat: "Personas",
    shape: "lineal",
    steps: ["Registrar la asistencia", "Validar las incidencias", "Aplicar los permisos autorizados"],
    owner: "bruno",
    ana: "viewer",
    versions: 2,
  },
  {
    name: "Aprobación de horas extra",
    cat: "Personas",
    shape: "revision",
    steps: ["Solicitar las horas extra", "Validar el saldo disponible", "Aprobación del jefe directo"],
    d: ["¿El saldo de horas alcanza?"],
    loop: "Ajustar la cantidad solicitada",
    versions: 2,
  },
  {
    name: "Entrevista de salida",
    cat: "Personas",
    shape: "aprobacion",
    steps: ["Realizar la entrevista", "Redactar el informe de salida"],
    d: ["¿El informe está completo?"],
    archive: "Archivar el informe y cerrar el legajo",
    versions: 2,
  },

  // --- Contratación (10) ---
  {
    name: "Contratación de un proveedor",
    cat: "Contratación",
    shape: "aprobacion",
    steps: ["Definir el alcance", "Pedir tres cotizaciones", "Evaluar las propuestas", "Firmar el contrato"],
    d: ["¿Las cotizaciones son comparables?", "¿Autoriza la dirección?"],
    archive: "Registrar el contrato firmado",
    versions: 2,
    bruno: "editor",
  },
  {
    name: "Licitación pública",
    cat: "Contratación",
    shape: "compuesto",
    steps: ["Publicar el pliego", "Recibir las ofertas", "Evaluar técnica y economicamente", "Adjudicar y publicar"],
    d: ["¿Se recibieron ofertas válidas?", "¿La evaluación técnica está completa?", "¿Se adjudica?"],
    par: ["Evaluación técnica", "Evaluación económica"],
    merge: "Consolidar el cuadro comparativo",
    loop: "Solicitar aclaraciones al oferente",
    escalate: "Elevar al comité de licitaciones",
    archive: "Publicar el acto de adjudicación",
    versions: 3,
    bruno: "editor",
  },
  {
    name: "Contratación de una obra",
    cat: "Contratación",
    shape: "compuesto",
    steps: ["Elaborar el pliego de obra", "Cotizar y comparar", "Adjudicar el contrato", "Recibir la obra"],
    d: ["¿Las ofertas son comparables?", "¿El acta de recepción está firmada?", "¿Se libera el anticipo?"],
    par: ["Controlar el avance de obra", "Verificar materiales empleados"],
    merge: "Consolidar el informe de seguimiento",
    loop: "Observar los trabajos",
    escalate: "Escalar a la gerencia de obra",
    archive: "Cerrar el expediente de obra",
    versions: 2,
  },
  {
    name: "Compra directa por monto menor",
    cat: "Contratación",
    shape: "lineal",
    steps: ["Verificar que el monto esté en rango", "Pedir la cotización", "Autorizar la compra", "Registrar el gasto"],
    versions: 2,
  },
  {
    name: "Renovación de contrato",
    cat: "Contratación",
    shape: "revision",
    steps: ["Revisar las condiciones actuales", "Negociar los nuevos términos", "Firmar la renovación"],
    d: ["¿El proveedor mantiene el mismo nivel de servicio?"],
    loop: "Reponer el proceso de licitación",
    versions: 2,
  },
  {
    name: "Contratación de servicios profesionales",
    cat: "Contratación",
    shape: "aprobacion",
    steps: ["Definir el objeto del contrato", "Seleccionar al profesional", "Firmar el contrato"],
    d: ["¿El currículum cumple los requisitos?", "¿Autoriza el área solicitante?"],
    archive: "Registrar el contrato y el alta de proveedor",
    versions: 2,
  },
  {
    name: "Alta de proveedor nuevo",
    cat: "Contratación",
    shape: "revision",
    steps: ["Recibir la documentación fiscal", "Validar los datos bancarios", "Aprobar el alta"],
    d: ["¿La documentación fiscal está completa?"],
    loop: "Solicitar la documentación faltante",
    versions: 2,
  },
  {
    name: "Penalidades por incumplimiento de contrato",
    cat: "Contratación",
    shape: "revision",
    steps: ["Documentar el incumplimiento", "Notificar al proveedor", "Aplicar la penalidad"],
    d: ["¿El incumplimiento está en el contrato?"],
    loop: "Reevaluar la penalidad propuesta",
    versions: 2,
  },
  {
    name: "Homologación de proveedores",
    cat: "Contratación",
    shape: "compuesto",
    steps: ["Recibir la solicitud de homologación", "Auditar al proveedor", "Emitir el informe de evaluación", "Registrar la homologación"],
    d: ["¿Cumple los requisitos técnicos?", "¿La auditoría está aprobada?", "¿Se homologa?"],
    par: ["Auditar calidad", "Auditar capacidad productiva"],
    merge: "Consolidar el informe de auditoría",
    loop: "Pedir documentación adicional",
    escalate: "Escalar al comité de homologación",
    archive: "Actualizar el padrón de proveedores homologados",
    versions: 2,
  },

  // --- Compras (12) ---
  {
    name: "Pedido de compra",
    cat: "Compras",
    shape: "revision",
    steps: ["Revisar el pedido", "Validar el stock y el precio", "Decidir la aprobación"],
    d: ["¿Se aprueba el pedido?"],
    loop: "Corregir el pedido",
    merge: "Notificar al solicitante",
    versions: 3,
    bruno: "editor",
    invitation: true,
  },
  {
    name: "Solicitud de compra interna",
    cat: "Compras",
    shape: "lineal",
    steps: ["Detectar la necesidad", "Completar la solicitud", "Enviar al responsable"],
    versions: 2,
  },
  {
    name: "Compra de insumos",
    cat: "Compras",
    shape: "revision",
    steps: ["Recibir la solicitud", "Consultar disponibilidad", "Generar la orden de compra"],
    d: ["¿El insumo está en el catálogo?"],
    loop: "Cotizar fuera del catálogo",
    versions: 2,
  },
  {
    name: "Comparación de precios",
    cat: "Compras",
    shape: "paralelo",
    steps: ["Pedir cotizaciones", "Analizar la información", "Elegir la opción"],
    d: ["¿Se comparan tres o más ofertas?"],
    par: ["Consultar precio de mercado", "Consultar proveedores internos"],
    merge: "Consolidar el análisis de precios",
    versions: 2,
  },
  {
    name: "Compra por catálogo",
    cat: "Compras",
    shape: "lineal",
    steps: ["Buscar el artículo en el catálogo", "Agregar al pedido", "Confirmar el pedido"],
    versions: 2,
  },
  {
    name: "Compra urgente",
    cat: "Compras",
    shape: "revision",
    steps: ["Justificar la urgencia", "Obtener la autorización del director", "Comprar y documentar"],
    d: ["¿La urgencia está justificada?"],
    loop: "Pasar por el circuito regular",
    versions: 2,
  },
  {
    name: "Autorización de gasto",
    cat: "Compras",
    shape: "aprobacion",
    steps: ["Completar la solicitud de gasto", "Verificar el presupuesto disponible"],
    d: ["¿Hay presupuesto disponible?", "¿Supera el límite del área?"],
    archive: "Registrar el gasto aprobado",
    versions: 2,
    bruno: "editor",
  },
  {
    name: "Recepción de mercadería",
    cat: "Compras",
    shape: "lineal",
    steps: ["Recibir la mercadería", "Contar y verificar", "Ingresar al almacén"],
    versions: 2,
  },
  {
    name: "Devolución de mercadería",
    cat: "Compras",
    shape: "revision",
    steps: ["Recibir la devolución", "Verificar el estado", "Emitir la nota de crédito"],
    d: ["¿La mercadería está en condiciones de reponer?"],
    loop: "Enviar la mercadería a preventa",
    versions: 2,
  },
  {
    name: "Orden de compra a proveedor",
    cat: "Compras",
    shape: "aprobacion",
    steps: ["Redactar la orden de compra", "Verificar los precios pactados", "Enviar al proveedor"],
    d: ["¿El precio coincide con el contrato?", "¿Autoriza Compras?"],
    archive: "Archivar la orden confirmada",
    versions: 2,
  },
  {
    name: "Subasta inversa de insumos",
    cat: "Compras",
    shape: "compuesto",
    steps: ["Publicar las bases de la subasta", "Recibir las ofertas", "Adjudicar al mejor precio", "Emitir la orden"],
    d: ["¿Se recibieron ofertas válidas?", "¿El precio es de mercado?", "¿Se adjudica?"],
    par: ["Analizar precio", "Analizar condiciones de entrega"],
    merge: "Consolidar el informe de la subasta",
    loop: "Pedir aclaraciones",
    escalate: "Escalar a Compras Centrales",
    archive: "Notificar el resultado a los oferentes",
    versions: 2,
  },
  {
    name: "Planificación de compras anual",
    cat: "Compras",
    shape: "compuesto",
    steps: ["Consolidar las necesidades del año", "Estimar precios y volúmenes", "Presentar el plan a Dirección", "Negociar los contratos anuales"],
    d: ["¿Las necesidades están consolidadas?", "¿Hay proveedores suficientes?", "¿Se aprueba el plan?"],
    par: ["Analizar demanda histórica", "Analizar precios de mercado"],
    merge: "Consolidar el plan anual",
    loop: "Ajustar las estimaciones",
    escalate: "Escalar a Dirección de Compras",
    archive: "Aprobar el presupuesto de compras",
    versions: 3,
    bruno: "editor",
  },
  {
    name: "Evaluación de desempeño de proveedores",
    cat: "Compras",
    shape: "aprobacion",
    steps: ["Relevar la calidad recibida", "Relevar el cumplimiento de plazos", "Definir la calificación"],
    d: ["¿El proveedor está en el mínimo exigido?", "¿Requiere plan de mejora?"],
    archive: "Comunicar la evaluación al proveedor",
    versions: 2,
  },

  // --- Inventario (12) ---
  {
    name: "Ingreso de stock al almacén",
    cat: "Inventario",
    shape: "lineal",
    steps: ["Descargar la mercadería", "Contar y etiquetar", "Registrar el ingreso en el sistema"],
    versions: 2,
  },
  {
    name: "Salida de mercadería por venta",
    cat: "Inventario",
    shape: "lineal",
    steps: ["Preparar la orden de salida", "Despachar del almacén", "Descontar del stock"],
    versions: 2,
  },
  {
    name: "Transferencia entre almacenes",
    cat: "Inventario",
    shape: "revision",
    steps: ["Solicitar la transferencia", "Despachar desde el origen", "Recibir en el destino"],
    d: ["¿Hay stock disponible en el origen?"],
    loop: "Reponer stock antes de transferir",
    versions: 2,
  },
  {
    name: "Ajuste de inventario por conteo cíclico",
    cat: "Inventario",
    shape: "paralelo",
    steps: ["Planificar el conteo", "Contar los ítems", "Aplicar los ajustes"],
    d: ["¿El conteo es por zona?"],
    par: ["Contar zona A", "Contar zona B"],
    merge: "Consolidar los conteos",
    versions: 2,
  },
  {
    name: "Reposición de stock mínimo",
    cat: "Inventario",
    shape: "revision",
    steps: ["Detectar el stock bajo mínimo", "Generar la orden de reposición", "Recibir la mercadería"],
    d: ["¿El proveedor tiene stock disponible?"],
    loop: "Buscar otro proveedor",
    versions: 2,
  },
  {
    name: "Inventario anual",
    cat: "Inventario",
    shape: "compuesto",
    steps: ["Congelar los movimientos", "Contar todo el almacén", "Validar los conteos ciegos", "Conciliar el resultado"],
    d: ["¿El conteo está completo?", "¿Hay diferencias relevantes?", "¿Se cierra el inventario?"],
    par: ["Contar salón de ventas", "Contar depósito"],
    merge: "Consolidar el conteo general",
    loop: "Recuento dirigido de los faltantes",
    escalate: "Escalar diferencias a auditoría",
    archive: "Ajustar el valor del inventario",
    versions: 2,
    bruno: "editor",
  },
  {
    name: "Baja de mercadería por deterioro",
    cat: "Inventario",
    shape: "aprobacion",
    steps: ["Identificar la mercadería deteriorada", "Documentar el estado", "Solicitar la baja"],
    d: ["¿El deterioro es menor al límite?", "¿Autoriza la baja?"],
    archive: "Registrar la baja en el inventario",
    versions: 2,
  },
  {
    name: "Reserva de mercadería",
    cat: "Inventario",
    shape: "lineal",
    steps: ["Recibir la reserva del cliente", "Bloquear el stock", "Confirmar la reserva"],
    versions: 2,
  },
  {
    name: "Reporte de stock muerto",
    cat: "Inventario",
    shape: "aprobacion",
    steps: ["Detectar ítems sin rotación", "Proponer una salida", "Definir el destino"],
    d: ["¿El margen permite mantenerlo?", "¿Autoriza la salida?"],
    archive: "Notificar y archivar el reporte",
    versions: 2,
  },
  {
    name: "Recepción de devoluciones de clientes",
    cat: "Inventario",
    shape: "paralelo",
    steps: ["Recibir el producto devuelto", "Revisar su estado", "Registrar la devolución"],
    d: ["¿El producto está en buen estado?"],
    par: ["Reponer al stock", "Enviar a revisión técnica"],
    merge: "Consolidar la recepción de devoluciones",
    versions: 2,
  },
  {
    name: "Merma y descarte",
    cat: "Inventario",
    shape: "revision",
    steps: ["Detectar la merma", "Cuantificar la pérdida", "Registrar el descarte"],
    d: ["¿La merma supera el límite permitido?"],
    loop: "Investigar las causas de la merma",
    versions: 2,
  },
  // --- Ventas (12) ---
  {
    name: "Alta de cliente nuevo",
    cat: "Ventas",
    shape: "revision",
    steps: ["Recibir la documentación del cliente", "Validar la información fiscal", "Crear el cliente en el sistema"],
    d: ["¿Los datos fiscales están completos?"],
    loop: "Solicitar datos faltantes",
    versions: 2,
  },
  {
    name: "Cotización formal al cliente",
    cat: "Ventas",
    shape: "aprobacion",
    steps: ["Relevar el pedido del cliente", "Calcular el precio", "Enviar la cotización"],
    d: ["¿El precio respeta el mínimo?", "¿Autoriza el descuento?"],
    archive: "Registrar y enviar la cotización",
    versions: 2,
  },
  {
    name: "Creación de orden de venta",
    cat: "Ventas",
    shape: "lineal",
    steps: ["Confirmar el pedido", "Generar la orden de venta", "Confirmar el stock disponible"],
    versions: 2,
  },
  {
    name: "Aprobación de descuento comercial",
    cat: "Ventas",
    shape: "revision",
    steps: ["Recibir la solicitud de descuento", "Evaluar el impacto en el margen", "Autorizar el descuento"],
    d: ["¿El descuento está en rango?"],
    loop: "Replantear el precio final",
    versions: 2,
  },
  {
    name: "Facturación y cobranza",
    cat: "Ventas",
    shape: "paralelo",
    steps: ["Emitir la factura", "Realizar el seguimiento del pago", "Conciliar el cobro"],
    d: ["¿El cliente paga por transferencia?"],
    par: ["Emitir factura electrónica", "Registrar el pago recibido"],
    merge: "Consolidar la cobranza",
    versions: 2,
  },
  {
    name: "Cobranza judicial",
    cat: "Ventas",
    shape: "compuesto",
    steps: ["Requerimiento extrajudicial", "Preparear la demanda", "Presentar la demanda", "Seguir el expediente"],
    d: ["¿El deudor ignores el requerimiento?", "¿La demanda está preparada?", "¿Se recupera el monto?"],
    par: ["Estimar el monto recuperable", "Evaluar el riesgo del deudor"],
    merge: "Consolidar la evaluación",
    loop: "Intentar un acuerdo de pago",
    escalate: "Escalar a Estudios Jurídicos",
    archive: "Cerrar el expediente de cobranza",
    versions: 2,
  },
  {
    name: "Devolución de venta",
    cat: "Ventas",
    shape: "revision",
    steps: ["Recibir la solicitud de devolución", "Verificar la política de devolución", "Emitir la nota de crédito"],
    d: ["¿Está dentro del plazo permitido?"],
    loop: "Rechazar la devolución con fundamento",
    versions: 2,
  },
  {
    name: "Descuento por volumen",
    cat: "Ventas",
    shape: "lineal",
    steps: ["Detectar el volumen comprado", "Aplicar la escala de descuento", "Registrar en la factura"],
    versions: 2,
  },
  {
    name: "Reclamo del cliente",
    cat: "Ventas",
    shape: "compuesto",
    steps: ["Recibir el reclamo", "Investigar la causa", "Aplicar la solución acordada", "Resolver y responder"],
    d: ["¿La empresa tiene responsabilidad?", "¿La solución es un reembolso?", "¿El cliente acepta?"],
    par: ["Revisar el historial del cliente", "Revisar los registros de venta"],
    merge: "Consolidar el diagnóstico",
    loop: "Ampliar la investigación",
    escalate: "Escalar al responsable de servicio",
    archive: "Registrar el reclamo como aprendizaje",
    versions: 3,
    bruno: "editor",
  },
  {
    name: "Programa de fidelización",
    cat: "Ventas",
    shape: "lineal",
    steps: ["Definir el programa de puntos", "Cargar las reglas", "Comunicar a los clientes"],
    versions: 2,
  },
  {
    name: "Registro de venta perdida",
    cat: "Ventas",
    shape: "revision",
    steps: ["Registrar la oportunidad perdida", "Clasificar el motivo"],
    d: ["¿El motivo es precio?"],
    loop: "Registrar otro motivo",
    versions: 2,
  },
  {
    name: "Lista de precios y promociones",
    cat: "Ventas",
    shape: "revision",
    steps: ["Actualizar la lista de precios", "Cargar las promociones vigentes", "Comunicar a la fuerza de ventas"],
    d: ["¿La promoción está aprobada?"],
    loop: "Rehacer la actualización",
    versions: 2,
  },

  // --- Logística (8) ---
  {
    name: "Preparación y despacho de pedido",
    cat: "Logística",
    shape: "paralelo",
    steps: ["Preparar el pedido", "Elegir el transporte", "Despachar"],
    d: ["¿Requiere transporte especial?"],
    par: ["Embalar y etiquetar", "Emitir la guía de despacho"],
    merge: "Confirmar el despacho",
    versions: 2,
  },
  {
    name: "Gestión de transportistas",
    cat: "Logística",
    shape: "aprobacion",
    steps: ["Seleccionar el transportista", "Negociar la tarifa", "Formalizar el acuerdo"],
    d: ["¿La tarifa está dentro del mercado?", "¿Autoriza Compras?"],
    archive: "Registrar el acuerdo en el padrón",
    versions: 2,
  },
  {
    name: "Seguimiento de envío",
    cat: "Logística",
    shape: "lineal",
    steps: ["Registrar la salida", "Consultar el estado", "Informar al cliente"],
    owner: "bruno",
    ana: "editor",
    versions: 2,
  },
  {
    name: "Entrega y confirmación",
    cat: "Logística",
    shape: "lineal",
    steps: ["Entregar la mercadería", "Obtener la conformidad", "Registrar la entrega"],
    versions: 2,
  },
  {
    name: "Incidencia de transporte",
    cat: "Logística",
    shape: "revision",
    steps: ["Reportar la incidencia", "Evaluar la responsabilidad", "Reponer la mercadería"],
    d: ["¿La mercadería está dañada?"],
    loop: "Reabrir el reclamo al transportista",
    versions: 2,
  },
  {
    name: "Optimización de rutas de reparto",
    cat: "Logística",
    shape: "compuesto",
    steps: ["Relevar los pedidos del día", "Planificar las rutas", "Asignar las rutas a los choferes", "Cerrar la operación"],
    d: ["¿Los pedidos están georreferenciados?", "¿La ruta reduce los kilómetros?", "¿Se aprueba la ruta?"],
    par: ["Optimizar por zona", "Optimizar por carga"],
    merge: "Consolidar la ruta final",
    loop: "Rehacer la planificación",
    escalate: "Escalar al coordinador de reparto",
    archive: "Cerrar la planilla de reparto",
    versions: 3,
  },
  {
    name: "Recepción en destino",
    cat: "Logística",
    shape: "lineal",
    steps: ["Recibir el envío", "Verificar y firmar", "Notificar la recepción"],
    owner: "bruno",
    ana: "editor",
    versions: 2,
  },
  {
    name: "Retorno de mercadería al depósito",
    cat: "Logística",
    shape: "revision",
    steps: ["Coordinar el retiro", "Transportar al depósito", "Ingresar el stock"],
    d: ["¿El retorno está autorizado?"],
    loop: "Rechazar el retorno fuera de plazo",
    versions: 2,
  },

  // --- Servicio al cliente (8) ---
  {
    name: "Alta de reclamo",
    cat: "Servicio al cliente",
    shape: "lineal",
    steps: ["Recibir el reclamo", "Registrar el ticket", "Derivar al área responsable"],
    owner: "bruno",
    ana: "viewer",
    versions: 2,
  },
  {
    name: "Clasificación y escalamiento de reclamos",
    cat: "Servicio al cliente",
    shape: "aprobacion",
    steps: ["Clasificar el reclamo", "Definir el nivel de prioridad"],
    d: ["¿Es un reclamo crítico?", "¿Requiere escalamiento?"],
    archive: "Asignar el reclamo al área correspondiente",
    versions: 2,
  },
  {
    name: "Resolución de reclamo",
    cat: "Servicio al cliente",
    shape: "revision",
    steps: ["Analizar el reclamo", "Proponer la solución", "Aplicar la solución"],
    d: ["¿La solución es satisfactoria?"],
    loop: "Reabrir el reclamo",
    versions: 2,
  },
  {
    name: "Cierre y evaluación de satisfacción",
    cat: "Servicio al cliente",
    shape: "lineal",
    steps: ["Confirmar la solución", "Enviar la encuesta", "Cerrar el ticket"],
    versions: 2,
  },
  {
    name: "Consulta de estado de pedido",
    cat: "Servicio al cliente",
    shape: "lineal",
    steps: ["Recibir la consulta", "Consultar el estado", "Responder al cliente"],
    owner: "bruno",
    ana: "viewer",
    versions: 2,
  },
  {
    name: "Reemplazo de producto defectuoso",
    cat: "Servicio al cliente",
    shape: "compuesto",
    steps: ["Recibir el producto defectuoso", "Verificar la garantía", "Coordinar la entrega o reparación", "Reemplazar o reparar"],
    d: ["¿Está dentro de la garantía?", "¿Corresponde reemplazo?", "¿El cliente acepta?"],
    par: ["Reparar el producto", "Reemplazar el producto"],
    merge: "Consolidar la solución del caso",
    loop: "Solicitar la documentación faltante",
    escalate: "Escalar a garantía de producto",
    archive: "Registrar la causa raíz del defecto",
    versions: 3,
  },
  {
    name: "Onboarding de cliente corporativo",
    cat: "Servicio al cliente",
    shape: "compuesto",
    steps: ["Reunión de inicio", "Configurar la cuenta", "Hacer la prueba de aceptación", "Capacitar al equipo del cliente"],
    d: ["¿El contrato está firmado?", "¿La cuenta quedó configurada?", "¿El cliente queda operativo?"],
    par: ["Configurar usuarios", "Cargar el catálogo del cliente"],
    merge: "Consolidar la puesta en marcha",
    loop: "Corregir la configuración",
    escalate: "Escalar al gestor de cuenta",
    archive: "Documentar el cierre del onboarding",
    versions: 2,
  },
  {
    name: "Baja de cliente",
    cat: "Servicio al cliente",
    shape: "revision",
    steps: ["Recibir la solicitud de baja", "Verificar las cuentas pendientes", "Desactivar el cliente"],
    d: ["¿No hay saldo pendiente?"],
    loop: "Regularizar el saldo antes de dar de baja",
    versions: 2,
  },

  // --- Calidad (6) ---
  {
    name: "Auditoría interna",
    cat: "Calidad",
    shape: "compuesto",
    steps: ["Planificar la auditoría", "Relevar los procesos", "Redactar el informe con hallazgos", "Emitir el informe"],
    d: ["¿El alcance está definido?", "¿Se verificaron los hallazgos?", "¿Se cierra la auditoría?"],
    par: ["Auditar el proceso auditado", "Revisar la documentación"],
    merge: "Consolidar los hallazgos",
    loop: "Ampliar la auditoría",
    escalate: "Escalar a la dirección de calidad",
    archive: "Hacer seguimiento de las acciones",
    versions: 2,
  },
  {
    name: "Reporte de no conformidad",
    cat: "Calidad",
    shape: "revision",
    steps: ["Detectar la no conformidad", "Describir el evento", "Notificar al responsable"],
    d: ["¿La no conformidad es menor?"],
    loop: "Derivar a investigación de causa",
    versions: 2,
  },
  {
    name: "Análisis de causa raíz",
    cat: "Calidad",
    shape: "compuesto",
    steps: ["Definir el problema", "Aplicar los cinco porqués", "Validar la causa con el equipo", "Definir la acción correctiva"],
    d: ["¿La causa raíz está confirmada?", "¿La acción está implementada?", "¿Se verifica la eficacia?"],
    par: ["Entrevistar al equipo", "Revisar los registros del proceso"],
    merge: "Consolidar el análisis",
    loop: "Repetir el análisis",
    escalate: "Escalar al comité de calidad",
    archive: "Cerrar el análisis de causa raíz",
    versions: 3,
  },
  {
    name: "Acción correctiva y verificación",
    cat: "Calidad",
    shape: "aprobacion",
    steps: ["Implementar la acción", "Verificar la eficacia"],
    d: ["¿La acción fue implementada?", "¿La eficacia está demostrada?"],
    archive: "Cerrar la no conformidad",
    versions: 2,
  },
  {
    name: "Control de calidad en recepción",
    cat: "Calidad",
    shape: "paralelo",
    steps: ["Recibir el lote", "Aplicar el plan de muestreo", "Liberar o rechazar el lote"],
    d: ["¿El muestreo es por lote?"],
    par: ["Controlar la documentación", "Controlar la calidad del producto"],
    merge: "Consolidar el resultado del control",
    versions: 2,
  },
  {
    name: "Certificación del sistema de gestión",
    cat: "Calidad",
    shape: "compuesto",
    steps: ["Preparar la auditoría externa", "Atender los hallazgos", "Cerrar las no conformidades", "Obtener el certificado"],
    d: ["¿La documentación está lista?", "¿Los hallazgos están cerrados?", "¿Se aprueba la certificación?"],
    par: ["Auditoría interna", "Revisión por la dirección"],
    merge: "Consolidar el estado de preparación",
    loop: "Atender las no conformidades",
    escalate: "Escalar a la gerencia general",
    archive: "Archivar el certificado",
    versions: 3,
  },

  // --- Finanzas (7) ---
  {
    name: "Aprobación de presupuesto",
    cat: "Finanzas",
    shape: "lineal",
    steps: ["Solicitar el monto", "Validar el presupuesto disponible", "Registrar la aprobación"],
    // Sin historial a propósito: es el proceso donde Bruno solo puede leer, y
    // con una sola versión nadie más que Ana lo tocó.
    bruno: "viewer",
  },
  {
    name: "Solicitud de pago a proveedor",
    cat: "Finanzas",
    shape: "aprobacion",
    steps: ["Recibir la factura del proveedor", "Validar la factura", "Programar el pago"],
    d: ["¿La factura coincide con la orden?", "¿Autoriza Finanzas?"],
    archive: "Registrar el pago efectuado",
    versions: 2,
    bruno: "editor",
  },
  {
    name: "Procesamiento de sueldos",
    cat: "Finanzas",
    shape: "paralelo",
    steps: ["Cerrar la asistencia del período", "Procesar la liquidación", "Pagar al personal"],
    d: ["¿Hay licencias y ausencias?"],
    par: ["Calcular sueldo fijo", "Calcular adicionales y descuentos"],
    merge: "Consolidar la liquidación",
    versions: 2,
  },
  {
    name: "Control de gastos de viajes",
    cat: "Finanzas",
    shape: "revision",
    steps: ["Recibir el reporte de gastos", "Validar los comprobantes", "Aprobar el reembolso"],
    d: ["¿Los comprobantes respaldan el gasto?"],
    loop: "Rechazar gastos sin respaldo",
    versions: 2,
  },
  {
    name: "Solicitud de anticipo",
    cat: "Finanzas",
    shape: "revision",
    steps: ["Recibir la solicitud de anticipo", "Verificar el saldo pendiente", "Otorgar el anticipo"],
    d: ["¿El anticipo está permitido?"],
    loop: "Rechazar la solicitud",
    versions: 2,
  },
  {
    name: "Cierre contable mensual",
    cat: "Finanzas",
    shape: "compuesto",
    steps: ["Cerrar los ingresos del mes", "Cerrar los gastos del mes", "Revisar las cuentas de resultado", "Emitir los estados contables"],
    d: ["¿Las cuentas están conciliadas?", "¿El resultado es razonable?", "¿Se cierra el mes?"],
    par: ["Conciliar bancos", "Conciliar cuentas a cobrar"],
    merge: "Consolidar el cierre",
    loop: "Corregir los asientos",
    escalate: "Escalar al contador mayor",
    archive: "Publicar los estados contables",
    versions: 3,
    bruno: "editor",
  },
  {
    name: "Conciliación bancaria",
    cat: "Finanzas",
    shape: "paralelo",
    steps: ["Descargar el extracto", "Comparar con el sistema", "Registrar las diferencias"],
    d: ["¿Hay diferencias?"],
    par: ["Conciliar por fecha", "Conciliar por importe"],
    merge: "Consolidar la conciliación",
    versions: 2,
  },
  {
    name: "Facturación de servicios",
    cat: "Finanzas",
    shape: "lineal",
    steps: ["Validar el servicio prestado", "Emitir la factura", "Registrar el cobro"],
    versions: 2,
  },

  // --- Legal (5) ---
  {
    name: "Revisión de contratos",
    cat: "Legal",
    shape: "paralelo",
    steps: ["Recibir el contrato a revisar", "Analizar las cláusulas", "Devolver el dictamen"],
    d: ["¿El contrato es estándar?"],
    par: ["Revisión legal", "Revisión técnica"],
    merge: "Consolidar el dictamen",
    versions: 2,
  },
  {
    name: "Firma de documentos legales",
    cat: "Legal",
    shape: "lineal",
    steps: ["Preparar el documento", "Firmar según el nivel de autorización", "Archivar la copia firmada"],
    versions: 2,
  },
  {
    name: "Requerimiento legal",
    cat: "Legal",
    shape: "compuesto",
    steps: ["Preparar el requerimiento", "Notificar a la contraparte", "Negociar los términos", "Gestionar el acuerdo"],
    d: ["¿El requerimiento está fundado?", "¿La contraparte admite?", "¿Se firma el acuerdo?"],
    par: ["Estimar el daño", "Revisar los antecedentes"],
    merge: "Consolidar la evaluación",
    loop: "Reformular el requerimiento",
    escalate: "Escalar a Dirección Legal",
    archive: "Archivar el acuerdo",
    versions: 3,
  },
  {
    name: "Protección de datos personales",
    cat: "Legal",
    shape: "revision",
    steps: ["Recibir la solicitud", "Verificar la identidad del titular", "Atender el requerimiento"],
    d: ["¿La solicitud es válida?"],
    loop: "Rechazar por falta de documentación",
    versions: 2,
  },
  {
    name: "Consulta jurídica interna",
    cat: "Legal",
    shape: "lineal",
    steps: ["Recibir la consulta", "Emitir el dictamen legal", "Comunicar al área solicitante"],
    versions: 2,
  },

  // --- Tecnología (5) ---
  {
    name: "Solicitud de acceso a un sistema",
    cat: "Tecnología",
    shape: "revision",
    steps: ["Recibir la solicitud", "Verificar los permisos del rol", "Habilitar el acceso"],
    d: ["¿El rol tiene el permiso?"],
    loop: "Rechazar por falta de permisos",
    versions: 2,
  },
  {
    name: "Alta y baja de usuarios en sistemas",
    cat: "Tecnología",
    shape: "paralelo",
    steps: ["Procesar la solicitud", "Verificar la documentación"],
    d: ["¿Es alta o baja?"],
    par: ["Dar de alta el usuario", "Dar de baja los accesos anteriores"],
    merge: "Consolidar la gestión de accesos",
    versions: 2,
  },
  {
    name: "Incidente de seguridad",
    cat: "Tecnología",
    shape: "compuesto",
    steps: ["Detectar el incidente", "Contenerlo", "Verificar la restauración", "Restaurar el servicio"],
    d: ["¿La contención es efectiva?", "¿El servicio está estable?", "¿Se cierra el incidente?"],
    par: ["Analizar el origen", "Evaluar el impacto"],
    merge: "Consolidar el diagnóstico",
    loop: "Escalar la contención",
    escalate: "Escalar al responsable de seguridad",
    archive: "Documentar el incidente y las lecciones",
    versions: 3,
    bruno: "editor",
  },
  {
    name: "Despliegue de un cambio en producción",
    cat: "Tecnología",
    shape: "compuesto",
    steps: ["Validar el cambio en pruebas", "Planificar el despliegue", "Ejecutar el despliegue", "Monitorear el despliegue"],
    d: ["¿Las pruebas pasaron?", "¿El despliegue es seguro?", "¿El servicio queda estable?"],
    par: ["Desplegar aplicación", "Desplegar base de datos"],
    merge: "Consolidar el despliegue",
    loop: "Revertir el cambio",
    escalate: "Escalar al líder técnico",
    archive: "Documentar el cambio desplegado",
    versions: 2,
  },
  {
    name: "Compra de licencias de software",
    cat: "Tecnología",
    shape: "aprobacion",
    steps: ["Requerir la licencia", "Evaluar la necesidad", "Adquirir la licencia"],
    d: ["¿Ya existe una licencia libre?", "¿Autoriza Tecnología?"],
    archive: "Registrar la licencia en el inventario",
    versions: 2,
  },

  // --- Salud (3) ---
  {
    name: "Admisión de paciente",
    cat: "Salud",
    shape: "paralelo",
    steps: ["Registrar al paciente", "Verificar la cobertura", "Asignar la habitación"],
    d: ["¿La cobertura está activa?"],
    par: ["Admisión administrativa", "Admisión clínica"],
    merge: "Consolidar la admisión",
    versions: 2,
  },
  {
    name: "Prescripción y entrega de medicamentos",
    cat: "Salud",
    shape: "compuesto",
    steps: ["Revisar la prescripción", "Preparar el medicamento", "Explicar el uso al paciente", "Entregar al paciente"],
    d: ["¿La dosis es correcta?", "¿Hay interacción medicamentosa?", "¿El paciente recibió la medicación?"],
    par: ["Verificar las interacciones", "Verificar la dosis máxima"],
    merge: "Consolidar la verificación",
    loop: "Contactar al médico tratante",
    escalate: "Escalar a la guardia clínica",
    archive: "Registrar la entrega en la historia clínica",
    versions: 3,
  },
  {
    name: "Alta médica y seguimiento",
    cat: "Salud",
    shape: "revision",
    steps: ["Evaluar el alta", "Indicar el tratamiento ambulatorio", "Programar el control"],
    d: ["¿El paciente evoluciona favorablemente?"],
    loop: "Extender la internación",
    versions: 2,
  },
];
