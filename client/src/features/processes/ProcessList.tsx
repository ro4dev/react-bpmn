/**
 * Vista de listado de procesos con búsqueda (Fase 3).
 * Permite ver, buscar y abrir procesos en el editor.
 */
import { useState, useEffect, useCallback } from "react";

import { processesApi, type ProcessMeta } from "../../lib/api/processes";
import "./ProcessList.css";

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

  const formatDate = (iso: string) => new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const statusClass = (status: ProcessMeta["status"]) => {
    switch (status) {
      case "válido": return "status-ok";
      case "con-advertencias": return "status-warn";
      case "con-errores": return "status-error";
      default: return "status-empty";
    }
  };

  const statusLabel = (status: ProcessMeta["status"]) => {
    switch (status) {
      case "válido": return "✓ Válido";
      case "con-advertencias": return "⚠ Advertencias";
      case "con-errores": return "✗ Errores";
      default: return "○ Vacío";
    }
  };

  return (
    <div className="rb-process-list">
      <header className="rb-process-list__header">
        <h2>Procesos</h2>
        <button className="rb-btn rb-btn--primary" onClick={onNew}>
          + Nuevo proceso
        </button>
      </header>

      <div className="rb-process-list__search">
        <input
          type="search"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar procesos"
        />
      </div>

      {error && <div className="rb-process-list__error" role="alert">{error}</div>}

      {loading ? (
        <div className="rb-process-list__loading">Cargando…</div>
      ) : processes.length === 0 ? (
        <div className="rb-process-list__empty">
          {search ? "No hay coincidencias" : "No hay procesos guardados. Creá uno nuevo."}
        </div>
      ) : (
        <table className="rb-process-list__table" role="grid">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Versión</th>
              <th>Actualizado</th>
              <th>Preview</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.id}>
                <td className="rb-process-list__name">{p.name}</td>
                <td>
                  <span className={`rb-badge ${statusClass(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td>v{p.currentVersion} ({p.versionCount} total)</td>
                <td>{formatDate(p.updatedAt)}</td>
                <td className="rb-process-list__preview">{p.preview}</td>
                <td>
                  <button
                    className="rb-btn rb-btn--secondary rb-btn--small"
                    onClick={() => onOpen(p)}
                    aria-label={`Abrir ${p.name}`}
                  >
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}