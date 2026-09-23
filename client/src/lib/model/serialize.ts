/**
 * Serialización entre el modelo de proceso (`ProcessModel`) y el estado de
 * trabajo del editor (nodas/aristas de React Flow), más validación runtime.
 */
import type { Edge, Node } from "@xyflow/react";

import { defaultLabelFor } from "./palette";
import {
  PROCESS_MODEL_VERSION,
  PROCESS_NODE_KINDS,
  type ProcessEdge,
  type ProcessModel,
  type ProcessNode,
  type ProcessNodeKind,
  type ProcessNodeProps,
} from "./types";

/** Datos que React Flow guarda por nodo del editor. */
export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  props: ProcessNodeProps;
}

/** Representación de un nodo del editor (React Flow). */
export type FlowNode = Node<FlowNodeData>;

/** Tipo de nodo de React Flow por cada kind del modelo. */
const KIND_TO_TYPE: Record<ProcessNodeKind, string> = {
  start: "start",
  end: "end",
  task: "task",
  decision: "decision",
};

/** Kind del modelo por cada tipo de nodo de React Flow. */
const TYPE_TO_KIND: Readonly<Record<string, ProcessNodeKind>> = {
  start: "start",
  end: "end",
  task: "task",
  decision: "decision",
};

/** Serializa el estado de React Flow al modelo de proceso. */
export function toProcessModel(nodes: FlowNode[], edges: Edge[]): ProcessModel {
  return {
    version: PROCESS_MODEL_VERSION,
    nodes: nodes.map((node): ProcessNode => ({
      id: node.id,
      kind: TYPE_TO_KIND[node.type ?? "task"] ?? "task",
      label: node.data.label,
      position: { x: node.position.x, y: node.position.y },
      props: { ...node.data.props },
    })),
    edges: edges.map((edge): ProcessEdge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(typeof edge.label === "string" ? { label: edge.label } : {}),
    })),
  };
}

/** Deserializa un modelo de proceso al estado de React Flow. */
export function fromProcessModel(model: ProcessModel): {
  nodes: FlowNode[];
  edges: Edge[];
} {
  return {
    nodes: model.nodes.map((processNode): FlowNode => ({
      id: processNode.id,
      type: KIND_TO_TYPE[processNode.kind],
      position: { x: processNode.position.x, y: processNode.position.y },
      data: {
        label: processNode.label || defaultLabelFor(processNode.kind),
        props: { ...processNode.props },
      },
    })),
    edges: model.edges.map((processEdge): Edge => ({
      id: processEdge.id,
      source: processEdge.source,
      target: processEdge.target,
      ...(processEdge.label ? { label: processEdge.label } : {}),
    })),
  };
}

/**
 * Valida la forma de un modelo de proceso desconocido (runtime).
 * Acepta objetos con estructura mínima y aristas con ids consistentes.
 */
export function validateProcessModel(value: unknown): value is ProcessModel {
  if (typeof value !== "object" || value === null) return false;

  const model = value as Record<string, unknown>;
  if (model.version !== PROCESS_MODEL_VERSION) return false;
  if (!Array.isArray(model.nodes) || !Array.isArray(model.edges)) return false;
  if (model.nodes.some((item) => !isValidProcessNode(item))) return false;
  if (model.edges.some((item) => !isValidProcessEdge(item))) return false;

  // Las aristas deben referenciar nodos existentes (ids consistentes).
  const ids = new Set<string>(
    model.nodes.map((item) => (item as ProcessNode).id),
  );
  return model.edges.every(
    (item) =>
      ids.has((item as ProcessEdge).source) && ids.has((item as ProcessEdge).target),
  );
}

function isValidProcessNode(value: unknown): value is ProcessNode {
  if (typeof value !== "object" || value === null) return false;

  const node = value as Record<string, unknown>;
  if (typeof node.id !== "string") return false;
  if (typeof node.label !== "string") return false;
  if (typeof node.kind !== "string") return false;
  if (!PROCESS_NODE_KINDS.includes(node.kind as ProcessNodeKind)) return false;

  const position = node.position as Record<string, unknown> | undefined;
  if (typeof position?.x !== "number" || typeof position?.y !== "number") {
    return false;
  }
  if (node.props !== undefined && (typeof node.props !== "object" || node.props === null)) {
    return false;
  }
  return true;
}

function isValidProcessEdge(value: unknown): value is ProcessEdge {
  if (typeof value !== "object" || value === null) return false;

  const edge = value as Record<string, unknown>;
  if (typeof edge.id !== "string") return false;
  if (typeof edge.source !== "string") return false;
  if (typeof edge.target !== "string") return false;
  if (edge.label !== undefined && typeof edge.label !== "string") return false;
  return true;
}