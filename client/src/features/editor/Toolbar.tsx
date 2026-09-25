/**
 * Barra de herramientas del editor: guardar/exportar/importar modelo,
 * deshacer/rehacer y exportación del diagrama como PNG/SVG.
 * Fase 3: agrega "Guardar en server" + "Volver a listado" + badge de versión.
 * Vive bajo `ReactFlowProvider` para acceder a la instancia de React Flow.
 */
import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useCallback } from "react";

import { exportDiagram, type ImageFormat } from "./exportImage";
import "./editor.css";

interface ToolbarProps {
  /** Guarda el modelo actual en localStorage de forma inmediata. */
  onSave: () => void;
  /** Descarga el modelo actual como JSON. */
  onExport: () => void;
  /** Abre el selector de archivo para importar un modelo JSON. */
  onImport: () => void;
  /** Deshace el último cambio del modelo. */
  onUndo: () => void;
  /** Rehace el cambio deshecho. */
  onRedo: () => void;
  /** Hay historia para deshacer. */
  canUndo: boolean;
  /** Hay historia para rehacer. */
  canRedo: boolean;
  /** Guarda el proceso actual en el servidor (crea/actualiza + versión). */
  onSaveServer: () => void;
  /** Vuelve a la vista de listado de procesos. */
  onBackToList: () => void;
  /** ID del proceso si se está editando uno existente (para mostrar en badge). */
  editingProcessId: string | null;
  /** Número de versión actual del modelo en el editor. */
  currentVersion: number;
}

/** Barra de herramientas del editor. */
export function Toolbar({
  onSave,
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSaveServer,
  onBackToList,
  editingProcessId,
  currentVersion,
}: ToolbarProps) {
  const { getNodes } = useReactFlow();
  const { getState } = useStoreApi();

  const handleExportImage = useCallback(
    (format: ImageFormat) => {
      exportDiagram(format, getNodes, getState().domNode).catch((error: unknown) => {
        console.error("No se pudo exportar el diagrama:", error);
      });
    },
    [getNodes, getState],
  );

  return (
    <nav className="rb-toolbar" aria-label="Barra de herramientas del editor">
      <button
        type="button"
        className="rb-toolbar__button rb-toolbar__button--nav"
        onClick={onBackToList}
        title="Volver al listado (Esc)"
      >
        ← Listado
      </button>

      <span className="rb-toolbar__separator" aria-hidden="true" />

      <button
        type="button"
        className="rb-toolbar__button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Deshacer (Ctrl+Z)"
      >
        Deshacer
      </button>
      <button
        type="button"
        className="rb-toolbar__button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Rehacer (Ctrl+Shift+Z)"
      >
        Rehacer
      </button>

      <span className="rb-toolbar__separator" aria-hidden="true" />

      <button type="button" className="rb-toolbar__button" onClick={onSave}>
        Guardar (local)
      </button>
      <button type="button" className="rb-toolbar__button rb-toolbar__button--server" onClick={onSaveServer}>
        {editingProcessId ? "Actualizar en server" : "Guardar en server"}
      </button>
      <button type="button" className="rb-toolbar__button" onClick={onExport}>
        Exportar JSON
      </button>
      <button type="button" className="rb-toolbar__button" onClick={onImport}>
        Importar JSON
      </button>

      <span className="rb-toolbar__separator" aria-hidden="true" />

      <button
        type="button"
        className="rb-toolbar__button"
        onClick={() => handleExportImage("png")}
      >
        Exportar PNG
      </button>
      <button
        type="button"
        className="rb-toolbar__button"
        onClick={() => handleExportImage("svg")}
      >
        Exportar SVG
      </button>

      <span className="rb-toolbar__separator" aria-hidden="true" />

      <span className="rb-toolbar__version-badge" aria-label={`Versión actual: ${currentVersion}`}>
        v{currentVersion}
      </span>
      {editingProcessId && (
        <span className="rb-toolbar__process-id" aria-label={`ID de proceso: ${editingProcessId}`}>
          #{editingProcessId.slice(0, 8)}
        </span>
      )}
    </nav>
  );
}