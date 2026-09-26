/**
 * Componente raíz (Fases 1-4).
 *
 * - `AuthProvider` + rutas: `/login`, `/register` públicas; `/`, `/editor`,
 *   `/invitaciones`, `/perfil` protegidas.
 * - `MainLayout` con header global (avatar, menú de usuario, invitaciones).
 * - El listado y el editor se manejan por estado (no por ruta) porque el modelo
 *   del editor vive en memoria: abrir un proceso es una acción, no una URL
 *   compartible. Ver AD-018.
 */
import { ReactFlowProvider } from "@xyflow/react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./App.css";
import { Canvas } from "./features/editor/Canvas";
import { Palette } from "./features/editor/Palette";
import { PropertiesPanel, type NodeChanges } from "./features/editor/PropertiesPanel";
import { Toolbar } from "./features/editor/Toolbar";
import { ValidationPanel } from "./features/editor/ValidationPanel";
import { ProcessList } from "./features/processes/ProcessList";
import { ShareModal } from "./features/processes/ShareModal";
import { VersionHistory } from "./features/processes/VersionHistory";
import { useProcessModel } from "./hooks/useProcessModel";
import { validateProcessModel } from "./lib/model/serialize";
import { validateProcess } from "./lib/validation/validateProcess";
import { processesApi, type ProcessMeta } from "./lib/api/processes";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Profile } from "./pages/Profile";
import { Invitations } from "./pages/Invitations";
import type { ProcessModel, Role } from "@shared/model/types";

/** Nombre del archivo generado al exportar el modelo. */
const EXPORT_FILE_NAME = "proceso.json";

/** Rutas públicas: redirigen a "/" si ya estás autenticado. */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  return isAuthenticated ? <Navigate to="/" replace state={{ from: location }} /> : <>{children}</>;
}

/** Rutas protegidas: redirigen a /login si no hay sesión. */
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

function LoadingScreen() {
  return (
    <div className="rb-loading" role="status">
      Cargando…
    </div>
  );
}

/** Layout con header global; las páginas renderizan en <Outlet/>. */
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
    <div className="app">
      <header className="app__header">
        <Link to="/" className="app__brand">
          <h1>react-bpmn</h1>
          <p className="app__tagline">Modelador web de procesos de negocio</p>
        </Link>

        <nav className="app__header-right" aria-label="Navegación">
          <Link to="/invitaciones" className="app__navlink">
            Invitaciones
          </Link>
          <Link to="/perfil" className="app__navlink">
            Perfil
          </Link>

          {user && (
            <div className="rb-user-menu" ref={menuRef}>
              <button
                type="button"
                className="rb-user-menu__trigger"
                onClick={() => setShowMenu(!showMenu)}
                aria-expanded={showMenu}
                aria-haspopup="menu"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="rb-user-avatar" />
                ) : (
                  <span className="rb-user-avatar rb-user-avatar--placeholder">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="rb-user-name">{user.name}</span>
              </button>
              {showMenu && (
                <div className="rb-user-menu__dropdown" role="menu">
                  <div className="rb-user-menu__header">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  <Link to="/perfil" className="rb-user-menu__item" role="menuitem" onClick={() => setShowMenu(false)}>
                    Mi perfil
                  </Link>
                  <Link to="/invitaciones" className="rb-user-menu__item" role="menuitem" onClick={() => setShowMenu(false)}>
                    Invitaciones
                  </Link>
                  <button
                    type="button"
                    className="rb-user-menu__item rb-user-menu__item--danger"
                    role="menuitem"
                    onClick={() => void logout()}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      <main className="app__main">
        <Outlet />
      </main>
    </div>
  );
}

/** Vista de listado + editor, con el estado compartido entre ambas. */
function Workspace() {
  const editor = useProcessModel();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; role: Role } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = editor.nodes.find((node) => node.id === selectedId) ?? null;
  const validationIssues = useMemo(() => validateProcess(editor.model), [editor.model]);

  const canEdit = !editing || editing.role === "owner" || editing.role === "editor";
  const isOwner = !editing || editing.role === "owner";
  const isEditorRoute = useIsEditorRoute();

  // Atajos de deshacer/rehacer.
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
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
        const parsed: unknown = JSON.parse(await file.text());
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

  const handleOpenProcess = useCallback(
    (meta: ProcessMeta) => {
      void (async () => {
        try {
          const full = await processesApi.get(meta.id);
          if (!validateProcessModel(full.model)) {
            setMessage("El proceso guardado tiene un formato inválido.");
            return;
          }
          editor.loadModel(full.model, full.currentVersion);
          setEditing({ id: full.id, name: full.name, role: full.role });
          setSelectedId(null);
          setShowHistory(false);
          setMessage(
            full.role === "owner"
              ? `Proceso "${full.name}" cargado (v${full.currentVersion}).`
              : `Proceso "${full.name}" cargado como ${full.role} (v${full.currentVersion}).`,
          );
          navigate("/editor");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Error al abrir el proceso.");
        }
      })();
    },
    [editor, navigate],
  );

  const handleNewProcess = useCallback(() => {
    editor.loadModel({ version: 1, nodes: [], edges: [] });
    editor.setVersion(1);
    setEditing(null);
    setSelectedId(null);
    setShowHistory(false);
    setMessage("Nuevo proceso creado. Guardalo en el server para começar a versionarlo.");
    navigate("/editor");
  }, [editor, navigate]);

  const handleSaveToServer = useCallback(async () => {
    if (!canEdit) {
      setMessage("Tu rol es de lectura: no podés guardar cambios.");
      return;
    }
    try {
      let id = editing?.id ?? null;
      let name = editing?.name ?? "";
      if (!id) {
        const entered = window.prompt("Nombre del proceso:", "Proceso sin nombre");
        if (entered === null) return;
        name = entered.trim() || "Proceso sin nombre";
      }

      const saved =
        id !== null
          ? await processesApi.update(id, { model: editor.model, comment: "Guardado manual" })
          : await processesApi.create({ name, model: editor.model, comment: "Versión inicial" });

      setEditing({ id: saved.id, name: saved.name, role: saved.role });
      editor.setVersion(saved.currentVersion);
      setMessage(`Proceso guardado en servidor (v${saved.currentVersion}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error guardando en servidor");
    }
  }, [canEdit, editing, editor]);

  /** Restaurar una versión: el modelo vuelve al editor como una versión nueva. */
  const handleRestored = useCallback(
    (model: ProcessModel, newVersion: number) => {
      editor.loadModel(model, newVersion);
      setMessage(`Versión restaurada (ahora estás en v${newVersion}).`);
    },
    [editor],
  );

  // --- Vista de listado ---
  if (!isEditorRoute) {
    return (
      <>
        {message && (
          <p className="app__message" role="status">
            {message}
          </p>
        )}
        <ProcessList onOpen={handleOpenProcess} onNew={handleNewProcess} />
      </>
    );
  }

  // --- Vista de editor ---
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
        onSaveServer={() => void handleSaveToServer()}
        onBackToList={() => {
          setEditing(null);
          setShowHistory(false);
          navigate("/");
        }}
        editingProcessId={editing?.id ?? null}
        currentVersion={editor.serverVersion ?? 1}
        onShowHistory={() => setShowHistory((v) => !v)}
        onShare={() => setShowShare(true)}
        role={editing?.role ?? "owner"}
        historyOpen={showHistory}
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
      {editing && !canEdit && (
        <p className="app__message app__message--warn" role="status">
          Tenés acceso de lectura a este proceso: podés verlo pero no guardarlo.
        </p>
      )}

      <div className={`app__workspace ${showHistory ? "has-history" : ""}`}>
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
          <PropertiesPanel node={selectedNode} onChange={handleNodeChange} readOnly={!canEdit} />
          <ValidationPanel issues={validationIssues} />
        </div>
        {showHistory && editing && (
          <VersionHistory
            processId={editing.id}
            currentVersion={editor.serverVersion ?? 1}
            canRestore={canEdit}
            onRestored={handleRestored}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {showShare && editing && (
        <ShareModal
          processId={editing.id}
          processName={editing.name}
          canManage={isOwner}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}

/** Lee la ruta actual sin necesidad de props (para no duplicar el estado). */
function useIsEditorRoute(): boolean {
  const location = useLocation();
  return location.pathname === "/editor";
}

/**
 * Ruta del workspace: listado y editor comparten estado, así que tienen que
 * ser la **misma** instancia de `Workspace` montada en ambas rutas (si fueran dos
 * `<Route>` distintas, React desmontaría al cambiar de ruta y se perdería el
 * modelo que está en memoria). Un solo `path="*"` con redirección interna lo
 * resuelve.
 */
function WorkspaceRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/" && location.pathname !== "/editor") {
      navigate("/", { replace: true });
    }
  }, [location.pathname, navigate]);

  return <Workspace />;
}

function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Públicas */}
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

          {/* Protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/invitaciones" element={<Invitations />} />
              <Route path="/perfil" element={<Profile />} />
              {/* Alias en inglés por si algún link antiguo apunta a /profile */}
              <Route path="/profile" element={<Navigate to="/perfil" replace />} />
              <Route path="*" element={<WorkspaceRoute />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <AppRouter />
    </ReactFlowProvider>
  );
}

export default App;
