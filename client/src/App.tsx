/**
 * Componente raíz: layout del editor + vista de listado de procesos (Fase 3).
 * - Vista "list": ProcessList con búsqueda + botón Nuevo.
 * - Vista "editor": editor completo (Canvas, Palette, Toolbar, etc.).
 * Estado: view ("list" | "editor"), processId (cuando se abre uno existente).
 * Mantiene autoguardado local (localStorage) + guarda en server explícito.
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
import { ProcessList } from "./features/processes/ProcessList";
import { useProcessModel } from "./hooks/useProcessModel";
import { validateProcessModel } from "./lib/model/serialize";
import { validateProcess } from "./lib/validation/validateProcess";

/** Nombre del archivo generado al exportar el modelo. */
const EXPORT_FILE_NAME = "proceso.json";

type View = "list" | "editor";

function App() {
  const editor = useProcessModel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = editor.nodes.find((node) => node.id === selectedId) ?? null;

  /** Problemas del modelo, derivados en tiempo real (ver AD-011). */
  const validationIssues = useMemo(
    () => validateProcess(editor.model),
    [editor.model],
  );

  // Atajos de deshacer/rehacer: Ctrl+Z y Ctrl+Shift+Z.
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

  // --- Acciones de la Toolbar ---
  const handleSave = useCallback(() => {
    editor.saveNow();
    setMessage("Modelo guardado en este navegador (autoguardado).");
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

  // --- Navegación List ⇄ Editor ---
  const handleOpenProcess = useCallback(
    (meta: { id: string; name: string }) => {
      // Cargar modelo desde server
      void (async () => {
        try {
          const res = await fetch(`/api/processes/${meta.id}`);
          if (!res.ok) throw new Error("No se pudo cargar el proceso");
          const { model } = await res.json();
          if (!validateProcessModel(model)) {
            setMessage("El proceso guardado tiene un formato inválido.");
            return;
          }
          editor.loadModel(model);
          setEditingProcessId(meta.id);
          setView("editor");
          setMessage(`Proceso "${meta.name}" cargado desde el servidor.`);
        } catch {
          setMessage("Error al abrir el proceso.");
        }
      })();
    },
    [editor],
  );

  const handleNewProcess = useCallback(() => {
    editor.loadModel({ version: 1, nodes: [], edges: [] });
    setEditingProcessId(null);
    setView("editor");
    setMessage("Nuevo proceso creado.");
  }, [editor]);

  const handleBackToList = useCallback(() => {
    setView("list");
    setEditingProcessId(null);
    setSelectedId(null);
  }, []);

  // --- Guardar en server (explícito) ---
  const handleSaveToServer = useCallback(async () => {
    try {
      const body = {
        name: editingProcessId
          ? undefined // mantendrá el nombre existente
          : prompt("Nombre del proceso:") || "Sin nombre",
        model: editor.model,
        comment: `Guardado manual v${editor.model.version + 1 || 1}`,
      };
      const url = editingProcessId
        ? `/api/processes/${editingProcessId}`
        : "/api/processes";
      const method = editingProcessId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error guardando en servidor");
      }
      const saved = await res.json();
      setEditingProcessId(saved.id);
      setMessage(`Proceso guardado en servidor (v${saved.currentVersion}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error guardando en servidor");
    }
  }, [editor.model, editingProcessId]);

  return (
    <ReactFlowProvider>
      <main className="app">
        <header className="app__header">
          <h1>react-bpmn</h1>
          <p className="app__tagline">Modelador web de procesos de negocio</p>
        </header>

        {view === "list" ? (
          <ProcessList onOpen={handleOpenProcess} onNew={handleNewProcess} />
        ) : (
          <>
            <Toolbar
              onSave={handleSave}
              onExport={handleExport}
              onImport={() => fileInputRef.current?.click()}
              onUndo={editor.undo}
              onRedo={editor.redo}
              canUndo={editor.canUndo}
              canRedo={editor.canRedo}
              onSaveServer={handleSaveToServer}
              onBackToList={handleBackToList}
              editingProcessId={editingProcessId}
              currentVersion={editor.model?.version ?? 1}
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
          </>
        )}
      </main>
    </ReactFlowProvider>
  );
}

export default App;