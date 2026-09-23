/**
 * Paleta de elementos del editor y constantes de drag-and-drop.
 */
import type { ProcessNodeKind } from "./types";

/** Entrada de la paleta de elementos del editor. */
export interface PaletteItem {
  kind: ProcessNodeKind;
  /** Etiqueta visible en la paleta. */
  label: string;
  /** Ayuda breve sobre el elemento. */
  description: string;
}

/** Paleta mínima de la Fase 1 (confirmada con el usuario). */
export const PALETTE: readonly PaletteItem[] = [
  { kind: "start", label: "Inicio", description: "Punto de arranque del flujo" },
  { kind: "end", label: "Fin", description: "Fin del flujo" },
  { kind: "task", label: "Tarea", description: "Paso o actividad" },
  { kind: "decision", label: "Decisión", description: "Ramo sí/no" },
];

/**
 * MIME usado para transferir el tipo de nodo entre la paleta y el canvas
 * en el drag-and-drop (HTML5 DataTransfer).
 */
export const DND_MIME = "application/react-bpmn-node-kind";

/** Devuelve la etiqueta por defecto para un tipo de nodo. */
export function defaultLabelFor(kind: ProcessNodeKind): string {
  return PALETTE.find((item) => item.kind === kind)?.label ?? kind;
}