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

// --- Auth & Colaboración (Fase 4) ---

/** Usuario del sistema. */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  createdAt: string;
}

/** Rol en un proceso. */
export type Role = "owner" | "editor" | "viewer";

/** Colaborador en un proceso. */
export interface ProcessCollaborator {
  processId: string;
  userId: string;
  role: Role;
  invitedAt: string;
}

/** Invitación pendiente. */
export interface Invitation {
  id: string;
  email: string;
  processId: string;
  role: Exclude<Role, "owner">;
  token: string;
  expiresAt: string;
  createdAt: string;
}

/** Payload del JWT access token. */
export interface JWTPayload {
  sub: string;      // userId
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

/** Tokens de autenticación. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Input para crear proceso (Fase 4: incluye ownerId). */
export interface CreateProcessInput {
  name: string;
  model: ProcessModel;
  comment?: string;
  ownerId: string;
}