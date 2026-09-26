/**
 * Vista de listado de procesos con búsqueda y filtro por alcance (Fases 3 y 4).
 * Permite ver, buscar y abrir procesos en el editor.
 * En la Fase 4 agrega el filtro "Mis / Compartidos / Todos" y el badge de rol,
 * porque con colaboración un mismo usuario ve procesos que no son suyos.
 */
import { useState, useEffect, useCallback } from "react";

import type { Role } from "@shared/model/types";
import { processesApi, type ProcessMeta } from "../../lib/api/processes";
import "./ProcessList.css";

/** Filtro de alcance sobre la lista. */
type Scope = "mine" | "shared" | "all";

const SCOPE_LABEL: Record<Scope, string> = {
  mine: "Míos",
  shared: "Compartidos",
  all: "Todos",
};

/** Etiquetas de rol para el badge. */
const ROLE_LABEL: Record<Role, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

interface ProcessListProps {
  onOpen: (process: ProcessMeta) => void;
  onNew: () => void;
}

/** Hook para búsqueda con debounce. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function ProcessList({ onOpen, onNew }: ProcessListProps) {
  const [processes, setProcesses] = useState<ProcessMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await processesApi.list(debouncedSearch || undefined);
      setProcesses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando procesos");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * El server devuelve todo lo que el usuario puede ver; el filtro por alcance
   * es de UI. "Compartidos" son los procesos donde NO es owner (o sea, recibió
   * acceso de otra persona).
   */
  const visible = processes.filter((p) => {
    if (scope === "mine") return p.role === "owner";
    if (scope === "shared") return p.role !== "owner";
    return true;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusClass = (status: ProcessMeta["status"]) => {
    switch (status) {
      case "válido":
        return "status-ok";
      case "con-advertencias":
        return "status-warn";
      case "con-errores":
        return "status-error";
      default:
        return "status-empty";
    }
  };

  const statusLabel = (status: ProcessMeta["status"]) => {
    switch (status) {
      case "válido":
        return "✓ Válido";
      case "con-advertencias":
        return "⚠ Advertencias";
      case "con-errores":
        return "✗ Errores";
      default:
        return "○ Vacío";
    }
  };

  const handleDelete = useCallback(
    async (p: ProcessMeta) => {
      if (!window.confirm(`¿Eliminar "${p.name}" y todas sus versiones? No se puede deshacer.`)) return;
      try {
        await processesApi.delete(p.id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar");
      }
    },
    [load],
  );

  return (
    <div className="rb-process-list">
      <header className="rb-process-list__header">
        <h2>Procesos</h2>
        <button className="rb-btn rb-btn--primary" onClick={onNew}>
          + Nuevo proceso
        </button>
      </header>

      <div className="rb-process-list__filters">
        <input
          type="search"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar procesos"
        />
        <div className="rb-process-list__scopes" role="tablist" aria-label="Filtrar procesos">
          {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              className={`rb-process-list__scope ${scope === s ? "is-active" : ""}`}
              onClick={() => setScope(s)}
            >
              {SCOPE_LABEL[s]}
              <span className="rb-process-list__scope-count">
                {s === "mine"
                  ? processes.filter((p) => p.role === "owner").length
                  : s === "shared"
                    ? processes.filter((p) => p.role !== "owner").length
                    : processes.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rb-process-list__error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rb-process-list__loading">Cargando…</div>
      ) : visible.length === 0 ? (
        <div className="rb-process-list__empty">
          {search
            ? "No hay coincidencias"
            : scope === "shared"
              ? "Todavía nadie te compartió un proceso."
              : scope === "mine"
                ? "No creaste ningún proceso todavía."
                : "No hay procesos guardados. Creá uno nuevo."}
        </div>
      ) : (
        <table className="rb-process-list__table" role="grid">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Versión</th>
              <th>Actualizado</th>
              <th>Preview</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td className="rb-process-list__name">{p.name}</td>
                <td>
                  <span className={`rb-role rb-role--${p.role}`}>{ROLE_LABEL[p.role]}</span>
                </td>
                <td>
                  <span className={`rb-badge ${statusClass(p.status)}`}>{statusLabel(p.status)}</span>
                </td>
                <td>
                  v{p.currentVersion} ({p.versionCount} total)
                </td>
                <td>{formatDate(p.updatedAt)}</td>
                <td className="rb-process-list__preview">{p.preview}</td>
                <td className="rb-process-list__actions">
                  <button
                    className="rb-btn rb-btn--secondary rb-btn--small"
                    onClick={() => onOpen(p)}
                    aria-label={`Abrir ${p.name}`}
                  >
                    Abrir
                  </button>
                  {p.role === "owner" && (
                    <button
                      className="rb-btn rb-btn--danger rb-btn--small"
                      onClick={() => void handleDelete(p)}
                      aria-label={`Eliminar ${p.name}`}
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
