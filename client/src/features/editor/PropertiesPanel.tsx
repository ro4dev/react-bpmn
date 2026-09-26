/**
 * Panel de propiedades: edita el nodo seleccionado (título, descripción y
 * responsable). Muestra un aviso si no hay nodo seleccionado.
 */
import { PALETTE } from "../../lib/model/palette";
import type { FlowNode } from "../../lib/model/serialize";
import type { ProcessNodeProps } from "../../lib/model/types";
import "./editor.css";

/** Cambios aplicables a un nodo desde el panel de propiedades. */
export interface NodeChanges {
  label?: string;
  props?: Partial<ProcessNodeProps>;
}

interface PropertiesPanelProps {
  /** Nodo seleccionado en el canvas, o null si no hay selección. */
  node: FlowNode | null;
  /** Aplica cambios al nodo seleccionado. */
  onChange: (changes: NodeChanges) => void;
  /** Solo lectura: el usuario tiene rol viewer sobre el proceso (Fase 4). */
  readOnly?: boolean;
}

/** Panel de propiedades del nodo seleccionado. */
export function PropertiesPanel({ node, onChange, readOnly = false }: PropertiesPanelProps) {
  if (node === null) {
    return (
      <aside className="rb-properties" aria-label="Panel de propiedades">
        <h2 className="rb-properties__title">Propiedades</h2>
        <p className="rb-properties__empty">Seleccioná un nodo para editarlo.</p>
      </aside>
    );
  }

  if (readOnly) {
    return (
      <aside className="rb-properties" aria-label="Panel de propiedades">
        <h2 className="rb-properties__title">Propiedades</h2>
        <p className="rb-properties__empty">
          <strong>{node.data.label}</strong> — solo lectura (tu rol es lector).
        </p>
      </aside>
    );
  }

  const paletteItem = PALETTE.find((item) => item.kind === node.type);
  const kindLabel = paletteItem?.label ?? node.type;
  const props = node.data.props ?? {};

  return (
    <aside className="rb-properties" aria-label="Panel de propiedades">
      <h2 className="rb-properties__title">Propiedades</h2>
      <p className="rb-properties__kind">Tipo: {kindLabel}</p>

      <div className="rb-properties__field">
        <label htmlFor="rb-prop-label">Título</label>
        <input
          id="rb-prop-label"
          type="text"
          value={node.data.label}
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </div>

      <div className="rb-properties__field">
        <label htmlFor="rb-prop-description">Descripción</label>
        <textarea
          id="rb-prop-description"
          rows={4}
          value={props.description ?? ""}
          onChange={(event) => onChange({ props: { description: event.target.value } })}
        />
      </div>

      <div className="rb-properties__field">
        <label htmlFor="rb-prop-assignee">Responsable</label>
        <input
          id="rb-prop-assignee"
          type="text"
          value={props.assignee ?? ""}
          onChange={(event) => onChange({ props: { assignee: event.target.value } })}
        />
      </div>
    </aside>
  );
}