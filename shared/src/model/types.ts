/**
 * Modelo de proceso: el corazón de la app.
 * Formato propio del proyecto (JSON propio), ver `docs/08-modelo-de-datos.md`.
 */

/** Versión del *formato* del modelo (no del proceso guardado). */
export const PROCESS_MODEL_VERSION = 1;

/** Tipos de nodo soportados por el editor (paleta de la Fase 1). */
export type ProcessNodeKind = "start" | "end" | "task" | "decision";

/** Propiedades editables de un nodo. */
export interface ProcessNodeProps {
  /** Descripción del paso. */
  description?: string;
  /** Responsable (rol o persona; texto libre en esta fase). */
  assignee?: string;
}

/** Nodo del modelo de proceso. */
export interface ProcessNode {
  id: string;
  kind: ProcessNodeKind;
  label: string;
  position: { x: number; y: number };
  props: ProcessNodeProps;
}

/** Arista: transición de un nodo origen a uno destino. */
export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  /** Etiqueta opcional (p. ej. "Sí" / "No"). */
  label?: string;
}

/** Modelo completo de un proceso: grafo dirigido de nodos y aristas. */
export interface ProcessModel {
  version: typeof PROCESS_MODEL_VERSION;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

/** Valores válidos de `ProcessNodeKind`, usados en validaciones runtime. */
export const PROCESS_NODE_KINDS: readonly ProcessNodeKind[] = [
  "start",
  "end",
  "task",
  "decision",
];