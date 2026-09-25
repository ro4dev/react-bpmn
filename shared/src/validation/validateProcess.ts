/**
 * Validación semántica del modelo de proceso (Fase 2).
 *
 * `validateProcess` es una función pura que trabaja sobre el `ProcessModel`
 * (sin depender de React Flow) y devuelve la lista de problemas del proceso:
 * errores (bloquean un proceso válido) y advertencias (cosas sospechosas).
 */
import type { ProcessModel, ProcessNode } from "../model/types";

/** Severidad de un problema detectado por la validación. */
export type IssueSeverity = "error" | "warning";

/** Problema detectado en un modelo de proceso. */
export interface ValidationIssue {
  severity: IssueSeverity;
  message: string;
  /** Ids de los nodos involucrados (opcional). */
  nodeIds?: string[];
}

/**
 * Valida un modelo de proceso y devuelve los problemas encontrados
 * (vacío si el proceso es válido). Reglas:
 * - error: proceso vacío, falta de Inicio, falta de Fin,
 *   nodos no alcanzables desde un Inicio, nodos que no llegan a un Fin.
 * - warning: más de un Inicio, nodos sin ninguna conexión.
 */
export function validateProcess(model: ProcessModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (model.nodes.length === 0) {
    issues.push({
      severity: "error",
      message: "El proceso está vacío: agregá al menos un Inicio y un Fin.",
    });
    return issues;
  }

  // Índices de grafo (entradas/salidas por nodo) para las reglas de conexión.
  const outgoing = new Map<string, string[]>(model.nodes.map((n) => [n.id, []]));
  const incoming = new Map<string, string[]>(model.nodes.map((n) => [n.id, []]));
  for (const edge of model.edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }

  const starts = model.nodes.filter((node) => node.kind === "start");
  const ends = model.nodes.filter((node) => node.kind === "end");

  if (starts.length === 0) {
    issues.push({ severity: "error", message: "Falta un nodo de Inicio." });
  } else if (starts.length > 1) {
    issues.push({
      severity: "warning",
      message: "Solo debería haber un único nodo de Inicio.",
      nodeIds: idsOf(starts),
    });
  }
  if (ends.length === 0) {
    issues.push({ severity: "error", message: "Falta un nodo de Fin." });
  }

  // Nodos sin ninguna arista entrante ni saliente.
  const isolated = model.nodes.filter(
    (node) => incoming.get(node.id)!.length === 0 && outgoing.get(node.id)!.length === 0,
  );
  if (isolated.length > 0) {
    issues.push({
      severity: "warning",
      message: `${isolated.length} nodo(s) sin ninguna conexión.`,
      nodeIds: idsOf(isolated),
    });
  }

  // Alcanzables desde algún Inicio (DFS hacia adelante).
  const reachable = reachFrom(starts, outgoing);
  const unreachable = model.nodes.filter((node) => !reachable.has(node.id));
  if (starts.length > 0 && unreachable.length > 0) {
    issues.push({
      severity: "error",
      message: `${unreachable.length} nodo(s) no alcanzables desde el Inicio.`,
      nodeIds: idsOf(unreachable),
    });
  }

  // Nodos desde los que se llega a algún Fin (DFS hacia atrás desde los fines).
  const reachesEnd = reachFrom(ends, incoming);
  const deadEnds = model.nodes.filter((node) => !reachesEnd.has(node.id));
  if (ends.length > 0 && deadEnds.length > 0) {
    issues.push({
      severity: "error",
      message: `${deadEnds.length} nodo(s) que no llegan a ningún Fin.`,
      nodeIds: idsOf(deadEnds),
    });
  }

  return issues;
}

/** Recorre el grafo desde `roots` siguiendo `next` y devuelve los ids alcanzables. */
function reachFrom(
  roots: ProcessNode[],
  next: Map<string, string[]>,
): Set<string> {
  const visited = new Set<string>();
  const stack = roots.map((node) => node.id);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const target of next.get(id) ?? []) stack.push(target);
  }
  return visited;
}

function idsOf(nodes: ProcessNode[]): string[] {
  return nodes.map((node) => node.id);
}