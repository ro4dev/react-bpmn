/**
 * Hook del editor: estado de nodos/aristas + historial de deshacer/rehacer +
 * persistencia local (autoguardado debounced en localStorage).
 *
 * El historial guarda snapshots del estado de trabajo `{nodes, edges}` (ver
 * AD-012): un checkpoint por acción discreta (agregar, conectar, eliminar,
 * inicio de arrastre) y agrupación por pausa para ediciones de texto.
 * Las acciones del usuario que mutan el grafo recaen en este hook para que
 * el autoguardado y el deshacer/rehacer queden sincronizados.
 */
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultLabelFor } from "../lib/model/palette";
import {
  fromProcessModel,
  toProcessModel,
  validateProcessModel,
  type FlowNode,
} from "../lib/model/serialize";
import {
  PROCESS_STORAGE_KEY,
  type ProcessModel,
  type ProcessNodeKind,
} from "../lib/model/types";

/** Milisegundos de espera antes de escribir el autoguardado. */
const AUTOSAVE_DELAY_MS = 500;

/**
 * Pausa mínima entre ediciones de propiedades para crear un checkpoint de
 * deshacer. Escrituras más rápidas que esto se agrupan en un solo paso.
 */
const EDIT_CHECKPOINT_PAUSE_MS = 700;

/** Snapshot del estado de trabajo para el historial deshacer/rehacer. */
type Snapshot = { nodes: FlowNode[]; edges: Edge[] };

/** Lee y valida el modelo guardado, o devuelve null si no hay/está corrupto. */
function loadSavedModel(): { nodes: FlowNode[]; edges: Edge[] } | null {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(PROCESS_STORAGE_KEY) ?? "null",
    );
    if (validateProcessModel(saved)) return fromProcessModel(saved);
  } catch {
    // Storage corrupto: se arranca con un modelo vacío.
  }
  return null;
}

/** Modelo inicial: se lee una sola vez al cargar el módulo. */
const initialModel = loadSavedModel();

/** Estado del editor + historial + persistencia local. */
export function useProcessModel() {
  const [nodes, setNodes] = useState<FlowNode[]>(() => initialModel?.nodes ?? []);
  const [edges, setEdges] = useState<Edge[]>(() => initialModel?.edges ?? []);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastEditAtRef = useRef(0);

  const model = useMemo(() => toProcessModel(nodes, edges), [nodes, edges]);

  // Autoguardado debounced: un cambio en el modelo programa una escritura.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(PROCESS_STORAGE_KEY, JSON.stringify(model));
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [model]);

  /** Guarda el modelo actual en localStorage de forma inmediata. */
  const saveNow = useCallback(() => {
    localStorage.setItem(PROCESS_STORAGE_KEY, JSON.stringify(model));
  }, [model]);

  /** Clona el estado de trabajo actual (snapshot para el historial). */
  const snapshot = useCallback(
    (): Snapshot => ({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    }),
    [nodes, edges],
  );

  /** Crea un checkpoint de deshacer con el estado actual y limpia el redo. */
  const pushCheckpoint = useCallback(() => {
    setPast((current) => [...current, snapshot()]);
    setFuture([]);
  }, [snapshot]);

  /** Deshace el último cambio (restaura el snapshot previo). */
  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((current) => [...current, snapshot()]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [past, snapshot]);

  /** Rehace el cambio deshecho más reciente. */
  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture(future.slice(0, -1));
    setPast((current) => [...current, snapshot()]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, snapshot]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      pushCheckpoint();
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${uid()}`,
          },
          current,
        ),
      );
    },
    [pushCheckpoint],
  );

  /**
   * Punto de control antes de una eliminación: React Flow lo invoca antes de
   * aplicar el borrado, así que el snapshot captura el estado con los nodos
   * todavía presentes. Devuelve `true` (Promise) para permitir el borrado.
   */
  const onBeforeDelete = useCallback(async (): Promise<boolean> => {
    pushCheckpoint();
    return true;
  }, [pushCheckpoint]);

  /** Punto de control al iniciar arrastrar un nodo (la posición final podrá deshacerse). */
  const onNodeDragStart = useCallback(() => {
    pushCheckpoint();
  }, [pushCheckpoint]);

  /** Agrega un nodo del tipo dado en una posición del canvas. */
  const addNode = useCallback(
    (kind: ProcessNodeKind, position: { x: number; y: number }): string => {
      pushCheckpoint();
      const id = `n-${uid()}`;
      const node: FlowNode = {
        id,
        type: kind,
        position,
        data: { label: defaultLabelFor(kind), props: {} },
      };
      setNodes((current) => [...current, node]);
      return id;
    },
    [pushCheckpoint],
  );

  /** Actualiza label o props de un nodo existente (agrupa ráfagas de escritura). */
  const updateNode = useCallback(
    (
      id: string,
      changes: { label?: string; props?: Partial<{ description?: string; assignee?: string }> },
    ) => {
      const now = Date.now();
      if (now - lastEditAtRef.current > EDIT_CHECKPOINT_PAUSE_MS) {
        pushCheckpoint();
      }
      lastEditAtRef.current = now;
      setNodes((current) =>
        current.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: changes.label ?? node.data.label,
                  props: { ...node.data.props, ...changes.props },
                },
              }
            : node,
        ),
      );
    },
    [pushCheckpoint],
  );

  /** Reemplaza el modelo completo (importación) y limpia el historial. */
  const loadModel = useCallback((next: ProcessModel) => {
    const restored = fromProcessModel(next);
    setNodes(restored.nodes);
    setEdges(restored.edges);
    setPast([]);
    setFuture([]);
    lastEditAtRef.current = 0;
  }, []);

  return {
    nodes,
    edges,
    model,
    saveNow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onBeforeDelete,
    onNodeDragStart,
    addNode,
    updateNode,
    loadModel,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

/** Id corto y único (sufijo aleatorio). */
function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}