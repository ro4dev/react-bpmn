/**
 * Lienzo del editor: canvas de React Flow con los nodos personalizados,
 * controles de viewport (zoom, minimapa, grid) y drag-and-drop desde la paleta.
 */
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
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
}

/** Lienzo del editor, envuelto en el provider que React Flow requiere. */
export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <EditorCanvas {...props} />
    </ReactFlowProvider>
  );
}

function EditorCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onDropNode,
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
        fitView
        snapToGrid
        snapGrid={[16, 16]}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}