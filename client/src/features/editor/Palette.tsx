/**
 * Paleta de elementos: lista de nodos arrastrables hacia el canvas.
 */
import type { DragEvent } from "react";

import { DND_MIME, PALETTE } from "../../lib/model/palette";
import type { ProcessNodeKind } from "../../lib/model/types";
import "./editor.css";

/** Paleta de elementos del editor. */
export function Palette() {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, kind: ProcessNodeKind) => {
    event.dataTransfer.setData(DND_MIME, kind);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="rb-palette" aria-label="Paleta de elementos">
      <h2 className="rb-palette__title">Elementos</h2>
      <ul className="rb-palette__list">
        {PALETTE.map((item) => (
          <li key={item.kind}>
            <button
              type="button"
              className={`rb-palette__item rb-palette__item--${item.kind}`}
              draggable
              onDragStart={(event) => handleDragStart(event, item.kind)}
            >
              <span className="rb-palette__item-label">{item.label}</span>
              <span className="rb-palette__item-desc">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}