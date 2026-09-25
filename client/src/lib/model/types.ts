/**
 * Re-export del modelo compartido (fuente de verdad en `shared/`).
 * Ver `shared/src/model/types.ts`.
 * Nota: `PROCESS_STORAGE_KEY` es exclusiva del client (localStorage).
 */
export {
  PROCESS_MODEL_VERSION,
  type ProcessNodeKind,
  type ProcessNodeProps,
  type ProcessNode,
  type ProcessEdge,
  type ProcessModel,
  PROCESS_NODE_KINDS,
} from "@shared/model/types";

/** Clave de localStorage donde se autoguarda el proceso actual (Fase 1). */
export const PROCESS_STORAGE_KEY = "react-bpmn:process:current";