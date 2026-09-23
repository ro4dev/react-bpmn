/**
 * Lienzo del editor: canvas de React Flow con los nodos personalizados,
 * controles de viewport (zoom, minimapa con colores por tipo, grid),
 * drag-and-drop desde la paleta y conexiones entre nodos.
 * El `ReactFlowProvider` vive en `App.tsx` (lo requiere `Toolbar` para exportar).
 */
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";
import type { DragEvent } from "react";

import { DND_MIME } from "../../lib/model/palette";
import type { ProcessNodeKind } from "../../lib/model/types";
import { PROCESS_NODE_KINDS } from "../../lib/model/types";
import type { FlowNode } from "../../lib/model/serialize";
import { DecisionNode, EndNode, StartNode, TaskNode } from "./nodes";
import "./editor.css";

/** Tipos de nodo personalizados (constante de módulo para no recrearla por render). */
const nodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  decision: DecisionNode,
};

/** Color del minimapa por tipo de nodo. */
const MINIMAP_COLORS: Record<string, string> = {
  start: "#16a34a",
  end: "#dc2626",
  task: "#0284c7",
  decision: "#d97706",
};

interface CanvasProps {
  nodes: FlowNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  /** Notifica el id del nodo seleccionado (o null si no hay selección). */
  onSelectionChange: (nodeId: string | null) => void;
  /** Agrega un nodo del tipo dado en una posición del canvas. */
  onDropNode: (kind: ProcessNodeKind, position: { x: number; y: number }) => void;
  /** Checkpoint de deshacer antes de una eliminación (React Flow lo llama antes de borrar). */
  onBeforeDelete: () => Promise<boolean>;
  /** Checkpoint de deshacer al iniciar arrastrar un nodo. */
  onNodeDragStart: () => void;
}

/** Lienzo del editor (requiere estar bajo `ReactFlowProvider`). */
export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onDropNode,
  onBeforeDelete,
  onNodeDragStart,
}: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rawKind = event.dataTransfer.getData(DND_MIME);
      if (!PROCESS_NODE_KINDS.includes(rawKind as ProcessNodeKind)) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onDropNode(rawKind as ProcessNodeKind, {
        x: Math.round(position.x),
        y: Math.round(position.y),
      });
    },
    [onDropNode, screenToFlowPosition],
  );

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams<FlowNode>) => {
      onSelectionChange(params.nodes[0]?.id ?? null);
    },
    [onSelectionChange],
  );

  return (
    <div className="rb-canvas" onDrop={handleDrop} onDragOver={handleDragOver}>
      <ReactFlow<FlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onBeforeDelete={onBeforeDelete}
        onNodeDragStart={onNodeDragStart}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node: Node) => MINIMAP_COLORS[node.type ?? "task"] ?? "#94a3b8"}
        />
      </ReactFlow>
    </div>
  );
}