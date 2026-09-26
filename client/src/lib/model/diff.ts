/**
 * Diff entre dos versiones de un `ProcessModel` (Fase 4).
 *
 * Pensado para el panel de historial: no es un diff de texto genérico sino uno
 * con semántica de grafo, así que reporta cambios en nodos (agregados/eliminados/
 * modificados) y en aristas por separado. Todo puro y sin dependencias para que
 * sea testeable.
 */
import type { ProcessModel, ProcessNode, ProcessEdge } from "@shared/model/types";

/** Cambio en un nodo. */
export interface NodeChange {
  kind: "added" | "removed" | "changed" | "moved";
  node: ProcessNode;
  /** Campos que cambiaron (solo para kind="changed"). */
  fields?: string[];
  /** Posición anterior (solo para kind="moved"). */
  previousPosition?: { x: number; y: number };
}

/** Cambio en una arista. */
export interface EdgeChange {
  kind: "added" | "removed";
  edge: ProcessEdge;
}

/** Resultado del diff entre dos modelos. */
export interface ModelDiff {
  nodes: NodeChange[];
  edges: EdgeChange[];
  /** Totales para el resumen ("2 nodos nuevos, 1 movido…"). */
  summary: {
    added: number;
    removed: number;
    changed: number;
    moved: number;
    edgesAdded: number;
    edgesRemoved: number;
  };
  /** Modelo resultante de aplicar el diff sobre `from` (para la vista previa). */
  next: ProcessModel;
}

/** Compara dos props de nodo y devuelve los nombres de las claves distintas. */
function changedFields(a: ProcessNode, b: ProcessNode): string[] {
  const fields: string[] = [];
  if (a.label !== b.label) fields.push("label");
  if (a.kind !== b.kind) fields.push("kind");
  if ((a.props.description ?? "") !== (b.props.description ?? "")) fields.push("description");
  if ((a.props.assignee ?? "") !== (b.props.assignee ?? "")) fields.push("assignee");
  return fields;
}

/** Compara dos modelos y devuelve el diff semántico. */
export function diffModels(from: ProcessModel, to: ProcessModel): ModelDiff {
  const nodes: NodeChange[] = [];
  const edges: EdgeChange[] = [];

  const fromNodes = new Map(from.nodes.map((n) => [n.id, n]));
  const toNodes = new Map(to.nodes.map((n) => [n.id, n]));

  // Nodos: primero los eliminados y modificados (sobre `from`), luego los nuevos.
  for (const node of from.nodes) {
    const next = toNodes.get(node.id);
    if (!next) {
      nodes.push({ kind: "removed", node });
      continue;
    }
    const fields = changedFields(node, next);
    if (fields.length > 0) {
      nodes.push({ kind: "changed", node: next, fields });
    } else if (node.position.x !== next.position.x || node.position.y !== next.position.y) {
      nodes.push({ kind: "moved", node: next, previousPosition: node.position });
    }
  }
  for (const node of to.nodes) {
    if (!fromNodes.has(node.id)) nodes.push({ kind: "added", node });
  }

  // Aristas: identidad por `source → target` (el id suele cambiar al recrear).
  const edgeKey = (e: ProcessEdge): string => `${e.source}→${e.target}`;
  const fromEdges = new Set(from.edges.map(edgeKey));
  const toEdges = new Map(to.edges.map((e) => [edgeKey(e), e]));

  for (const edge of from.edges) {
    if (!toEdges.has(edgeKey(edge))) edges.push({ kind: "removed", edge });
  }
  for (const edge of to.edges) {
    if (!fromEdges.has(edgeKey(edge))) edges.push({ kind: "added", edge });
  }

  const summary = {
    added: nodes.filter((c) => c.kind === "added").length,
    removed: nodes.filter((c) => c.kind === "removed").length,
    changed: nodes.filter((c) => c.kind === "changed").length,
    moved: nodes.filter((c) => c.kind === "moved").length,
    edgesAdded: edges.filter((c) => c.kind === "added").length,
    edgesRemoved: edges.filter((c) => c.kind === "removed").length,
  };

  return { nodes, edges, summary, next: to };
}

/** Resumen legible del diff (una línea). */
export function describeDiff(diff: ModelDiff): string {
  const parts: string[] = [];
  if (diff.summary.added) parts.push(`+${diff.summary.added} nodo${diff.summary.added > 1 ? "s" : ""}`);
  if (diff.summary.removed) parts.push(`-${diff.summary.removed} nodo${diff.summary.removed > 1 ? "s" : ""}`);
  if (diff.summary.changed) parts.push(`~${diff.summary.changed} editado${diff.summary.changed > 1 ? "s" : ""}`);
  if (diff.summary.moved) parts.push(`↔${diff.summary.moved} movido${diff.summary.moved > 1 ? "s" : ""}`);
  if (diff.summary.edgesAdded) parts.push(`+${diff.summary.edgesAdded} arista${diff.summary.edgesAdded > 1 ? "s" : ""}`);
  if (diff.summary.edgesRemoved) parts.push(`-${diff.summary.edgesRemoved} arista${diff.summary.edgesRemoved > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : "Sin cambios";
}
