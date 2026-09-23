/**
 * Hook del editor: estado de nodos/aristas + persistencia local.
 * Autoguarda el modelo en `localStorage` (debounced) y lo restaura al montar.
 * Es el stub de persistencia de la Fase 1; la API de procesos llega en la Fase 3.
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
import { useCallback, useEffect, useMemo, useState } from "react";

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

/** Estado del editor + persistencia local (Fase 1). */
export function useProcessModel() {
  const [nodes, setNodes] = useState<FlowNode[]>(() => initialModel?.nodes ?? []);
  const [edges, setEdges] = useState<Edge[]>(() => initialModel?.edges ?? []);

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

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${uid()}`,
        },
        current,
      ),
    );
  }, []);

  /** Agrega un nodo del tipo dado en una posición del canvas. */
  const addNode = useCallback(
    (kind: ProcessNodeKind, position: { x: number; y: number }): string => {
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
    [],
  );

  /** Actualiza label o props de un nodo existente. */
  const updateNode = useCallback(
    (
      id: string,
      changes: { label?: string; props?: Partial<{ description?: string; assignee?: string }> },
    ) => {
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
    [],
  );

  /** Reemplaza el modelo completo (importación o restauración). */
  const loadModel = useCallback((next: ProcessModel) => {
    const restored = fromProcessModel(next);
    setNodes(restored.nodes);
    setEdges(restored.edges);
  }, []);

  return {
    nodes,
    edges,
    model,
    saveNow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNode,
    loadModel,
  };
}

/** Id corto y único (sufijo aleatorio). */
function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}