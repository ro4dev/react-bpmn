/**
 * Componente raíz: layout del editor.
 * Envuelve todo en `ReactFlowProvider` (lo necesita `Toolbar` para exportar
 * imagen). El estado vive en `useProcessModel`; la validación del modelo se
 * deriva en tiempo real y se muestra en `ValidationPanel`.
 */
import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./App.css";
import { Canvas } from "./features/editor/Canvas";
import { Palette } from "./features/editor/Palette";
import {
  PropertiesPanel,
  type NodeChanges,
} from "./features/editor/PropertiesPanel";
import { Toolbar } from "./features/editor/Toolbar";
import { ValidationPanel } from "./features/editor/ValidationPanel";
import { useProcessModel } from "./hooks/useProcessModel";
import { validateProcessModel } from "./lib/model/serialize";
import { validateProcess } from "./lib/validation/validateProcess";

/** Nombre del archivo generado al exportar el modelo. */
const EXPORT_FILE_NAME = "proceso.json";

function App() {
  const editor = useProcessModel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = editor.nodes.find((node) => node.id === selectedId) ?? null;

  /** Problemas del modelo, derivados en tiempo real (ver AD-011). */
  const validationIssues = useMemo(
    () => validateProcess(editor.model),
    [editor.model],
  );

  // Atajos de deshacer/rehacer: Ctrl+Z y Ctrl+Shift+Z.
  // Se ignoran cuando el foco está en un input/textarea (deshacer nativo del campo).
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  const handleSave = useCallback(() => {
    editor.saveNow();
    setMessage("Modelo guardado en este navegador.");
  }, [editor]);

  const handleExport = useCallback(() => {
    const json = JSON.stringify(editor.model, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = EXPORT_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Modelo exportado como ${EXPORT_FILE_NAME}.`);
  }, [editor.model]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        if (!validateProcessModel(parsed)) {
          setMessage("El archivo no es un modelo de proceso válido.");
          return;
        }
        editor.loadModel(parsed);
        setSelectedId(null);
        setMessage(`Modelo importado desde ${file.name}.`);
      } catch {
        setMessage("No se pudo leer el archivo (JSON inválido).");
      }
    },
    [editor],
  );

  const handleNodeChange = useCallback(
    (changes: NodeChanges) => {
      if (selectedId === null) return;
      editor.updateNode(selectedId, changes);
    },
    [editor, selectedId],
  );

  return (
    <ReactFlowProvider>
      <main className="app">
        <header className="app__header">
          <h1>react-bpmn</h1>
          <p className="app__tagline">Modelador web de procesos de negocio</p>
        </header>

        <Toolbar
          onSave={handleSave}
          onExport={handleExport}
          onImport={() => fileInputRef.current?.click()}
          onUndo={editor.undo}
          onRedo={editor.redo}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="app__file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
            event.target.value = "";
          }}
        />

        {message && (
          <p className="app__message" role="status">
            {message}
          </p>
        )}

        <div className="app__workspace">
          <Palette />
          <Canvas
            nodes={editor.nodes}
            edges={editor.edges}
            onNodesChange={editor.onNodesChange}
            onEdgesChange={editor.onEdgesChange}
            onConnect={editor.onConnect}
            onSelectionChange={setSelectedId}
            onDropNode={editor.addNode}
            onBeforeDelete={editor.onBeforeDelete}
            onNodeDragStart={editor.onNodeDragStart}
          />
          <div className="app__side">
            <PropertiesPanel node={selectedNode} onChange={handleNodeChange} />
            <ValidationPanel issues={validationIssues} />
          </div>
        </div>
      </main>
    </ReactFlowProvider>
  );
}

export default App;