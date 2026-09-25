/**
 * Componente raíz: layout del editor + vista de listado + autenticación (Fase 4).
 * - AuthProvider: estado global de autenticación (user, accessToken, login, logout)
 * - Rutas públicas: /login, /register (redirigen a / si autenticado)
 * - Rutas protegidas: / (lista), /editor/* (editor), /profile (redirigen a /login si no autenticado)
 * - Header global con avatar + menú usuario (Perfil / Cerrar sesión)
 * Mantiene autoguardado local (localStorage) + guarda en server explícito.
 */
import { ReactFlowProvider } from "@xyflow/react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
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
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";

/** Nombre del archivo generado al exportar el modelo. */
const EXPORT_FILE_NAME = "proceso.json";

/** Rutas públicas: redirigen a "/" si ya autenticado. */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null; // esperar a que termine initAuth

  return isAuthenticated ? <Navigate to="/" replace state={{ from: location }} /> : <>{children}</>;
}

/** Rutas protegidas: redirigen a /login si no autenticado. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace state={{ from: location }} />;
}

/** Layout principal con header global. */
function MainLayout() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <main className="app">
      <header className="app__header">
        <div className="app__header-left">
          <h1>react-bpmn</h1>
          <p className="app__tagline">Modelador web de procesos de negocio</p>
        </div>
        <div className="app__header-right">
          {user && (
            <div className="rb-user-menu" ref={menuRef}>
              <button
                type="button"
                className="rb-user-menu__trigger"
                onClick={() => setShowMenu(!showMenu)}
                aria-expanded={showMenu}
                aria-haspopup="true"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="rb-user-avatar" />
                ) : (
                  <span className="rb-user-avatar rb-user-avatar--placeholder">{user.name[0].toUpperCase()}</span>
                )}
                <span className="rb-user-name">{user.name}</span>
              </button>
              {showMenu && (
                <div className="rb-user-menu__dropdown" role="menu">
                  <div className="rb-user-menu__header">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <a href="/profile" className="rb-user-menu__item" role="menuitem" onClick={() => setShowMenu(false)}>
                    Perfil
                  </a>
                  <button className="rb-user-menu__item rb-user-menu__item--danger" role="menuitem" onClick={() => logout()}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <Outlet />
    </main>
  );
}

/** Editor view (extraído para mantener App limpio). */
function EditorView() {
  const editor = useProcessModel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = editor.nodes.find((node) => node.id === selectedId) ?? null;

  const validationIssues = useMemo(
    () => validateProcess(editor.model),
    [editor.model],
  );

  // Atajos de deshacer/rehacer
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

  const handleBackToList = useCallback(() => {
    window.history.back(); // vuelve a la lista
  }, []);

  const handleSaveToServer = useCallback(async () => {
    try {
      const body = {
        name: editingProcessId
          ? undefined
          : prompt("Nombre del proceso:") || "Sin nombre",
        model: editor.model,
        comment: `Guardado manual`,
      };
      const url = editingProcessId
        ? `/api/processes/${editingProcessId}`
        : "/api/processes";
      const method = editingProcessId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error guardando en servidor");
      }
      const saved = await res.json();
      setEditingProcessId(saved.id);
      editor.setVersion(saved.currentVersion);
      setMessage(`Proceso guardado en servidor (v${saved.currentVersion}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error guardando en servidor");
    }
  }, [editor.model, editingProcessId, editor.setVersion]);

  return (
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
        currentVersion={editor.serverVersion ?? 1}
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
  );
}

/** List view con ProcessList. */
function ListView() {
  const editor = useProcessModel();

  const _handleOpenProcess = useCallback(
    (meta: { id: string; name: string; currentVersion: number }) => {
      void (async () => {
        try {
          const res = await fetch(`/api/processes/${meta.id}`, { credentials: "include" });
          if (!res.ok) throw new Error("No se pudo cargar el proceso");
          const { model } = await res.json();
          if (!validateProcessModel(model)) {
            window.alert("El proceso guardado tiene un formato inválido.");
            return;
          }
          editor.loadModel(model, meta.currentVersion);
          window.location.href = "/editor";
        } catch {
          window.alert("Error al abrir el proceso.");
        }
      })();
    },
    [editor],
  );

  const _handleNewProcess = useCallback(() => {
    editor.loadModel({ version: 1, nodes: [], edges: [] });
    window.location.href = "/editor";
  }, [editor]);

  return <ProcessList onOpen={_handleOpenProcess} onNew={_handleNewProcess} />;
}

/** App principal con router. */
function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rutas públicas */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* Rutas protegidas con layout principal */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={<ListView />} />
            <Route path="/editor" element={<EditorView />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** App wrapper con ReactFlowProvider. */
function App() {
  return (
    <ReactFlowProvider>
      <AppRouter />
    </ReactFlowProvider>
  );
}

export default App;