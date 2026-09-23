/**
 * Nodos personalizados del canvas (React Flow `nodeTypes`).
 * Cada tipo de nodo del modelo tiene su propia forma visual:
 * - Inicio: círculo verde · Fin: círculo rojo
 * - Tarea: rectángulo redondeado · Decisión: rombo
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowNodeData } from "../../lib/model/serialize";

function nodeClass(base: string, selected: boolean): string {
  return selected ? `${base} rb-node--selected` : base;
}

/** Nodo de Inicio del flujo (círculo; solo conexión de salida). */
export function StartNode({ data, selected }: NodeProps) {
  const typed = data as FlowNodeData;
  return (
    <div className={nodeClass("rb-node rb-node--start", selected)}>
      <span className="rb-node__label">{typed.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/** Nodo de Fin del flujo (círculo; solo conexión de entrada). */
export function EndNode({ data, selected }: NodeProps) {
  const typed = data as FlowNodeData;
  return (
    <div className={nodeClass("rb-node rb-node--end", selected)}>
      <span className="rb-node__label">{typed.label}</span>
      <Handle type="target" position={Position.Top} />
    </div>
  );
}

/** Nodo de Tarea (rectángulo; entrada y salida). */
export function TaskNode({ data, selected }: NodeProps) {
  const typed = data as FlowNodeData;
  return (
    <div className={nodeClass("rb-node rb-node--task", selected)}>
      <span className="rb-node__label">{typed.label}</span>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/** Nodo de Decisión (rombo; entrada y salida). */
export function DecisionNode({ data, selected }: NodeProps) {
  const typed = data as FlowNodeData;
  return (
    <div className={nodeClass("rb-node rb-node--decision", selected)}>
      <div className="rb-node__shape" />
      <span className="rb-node__label">{typed.label}</span>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}