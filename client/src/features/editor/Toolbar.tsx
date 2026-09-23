/**
 * Barra de herramientas del editor: guardar, exportar e importar el modelo.
 */
import "./editor.css";

interface ToolbarProps {
  /** Guarda el modelo actual en localStorage de forma inmediata. */
  onSave: () => void;
  /** Descarga el modelo actual como JSON. */
  onExport: () => void;
  /** Abre el selector de archivo para importar un modelo JSON. */
  onImport: () => void;
}

/** Barra de herramientas del editor. */
export function Toolbar({ onSave, onExport, onImport }: ToolbarProps) {
  return (
    <nav className="rb-toolbar" aria-label="Barra de herramientas del editor">
      <button type="button" className="rb-toolbar__button" onClick={onSave}>
        Guardar
      </button>
      <button type="button" className="rb-toolbar__button" onClick={onExport}>
        Exportar JSON
      </button>
      <button type="button" className="rb-toolbar__button" onClick={onImport}>
        Importar JSON
      </button>
    </nav>
  );
}