/**
 * Panel lateral de historial de versiones (Fase 4).
 *
 * Lista las versiones en orden descendente; al seleccionar una muestra el diff
 * contra la versión inmediatamente anterior (semántico, ver `lib/model/diff.ts`)
 * y permite restaurarla. Restaurar no borra nada: el server crea una versión N+1
 * con el modelo viejo, así que el historial es siempre inmutable.
 */
import { useCallback, useEffect, useState } from "react";

import { processesApi, type ProcessMeta, type ProcessVersionMeta } from "../../lib/api/processes";
import { describeDiff, diffModels, type ModelDiff } from "../../lib/model/diff";
import type { ProcessModel } from "@shared/model/types";
import "./VersionHistory.css";

interface VersionHistoryProps {
  processId: string;
  /** Versión actual en el editor (para marcar cuál es). */
  currentVersion: number;
  /** Permite restaurar: requiere rol owner o editor. */
  canRestore: boolean;
  /** Llamado tras restaurar, para que el editor recargue el modelo. */
  onRestored: (model: ProcessModel, newVersion: number) => void;
  onClose: () => void;
}

/** Formatea una fecha ISO en el formato local. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Nombre del autor de una versión, o `null` si no hay ninguno.
 *
 * `authorName` en null con `authorId` presente = el usuario fue borrado pero su
 * nombre se conservó (columna desnormalizada a propósito). Ambos en null = la
 * versión se creó sin autor (procesos anteriores a la Fase 4, ya migrados).
 */
function authorLabel(v: { authorId: string | null; authorName: string | null }): string | null {
  if (v.authorName) return v.authorName;
  if (v.authorId) return "Usuario eliminado";
  return null;
}

export function VersionHistory({
  processId,
  currentVersion,
  canRestore,
  onRestored,
  onClose,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<ProcessVersionMeta[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [diff, setDiff] = useState<ModelDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await processesApi.listVersions(processId);
      setVersions(data);
      // Por defecto mostrar la penúltima vs la última (el cambio más reciente).
      if (data.length >= 2) setSelected(data[1].version);
      else if (data.length === 1) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Carga el diff de la versión seleccionada contra la anterior. */
  useEffect(() => {
    if (selected === null) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setLoadingDiff(true);
    void (async () => {
      try {
        // El historial viene en orden descendente: la "anterior" es la siguiente.
        const index = versions.findIndex((v) => v.version === selected);
        const previousVersion = index >= 0 ? versions[index + 1]?.version : undefined;

        const [current, previous] = await Promise.all([
          processesApi.getVersion(processId, selected),
          previousVersion
            ? processesApi.getVersion(processId, previousVersion)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;
        // Contra la v1 no hay versión previa: comparamos contra el modelo vacío.
        setDiff(diffModels(previous?.model ?? { version: 1, nodes: [], edges: [] }, current.model));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudo calcular el diff");
          setDiff(null);
        }
      } finally {
        if (!cancelled) setLoadingDiff(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, versions, processId]);

  const handleRestore = useCallback(
    async (version: number) => {
      if (!window.confirm(`¿Restaurar la versión v${version}? Se creará una versión nueva con ese contenido.`)) {
        return;
      }
      setRestoring(true);
      setError(null);
      try {
        // Guardamos el modelo restaurado para que el editor quede consistente.
        const versionData = await processesApi.getVersion(processId, version);
        const meta: ProcessMeta = await processesApi.restoreVersion(processId, version);
        onRestored(versionData.model, meta.currentVersion);
        await load();
        setSelected(version);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo restaurar la versión");
      } finally {
        setRestoring(false);
      }
    },
    [processId, onRestored, load],
  );

  /** Autor de la versión seleccionada, para el encabezado del detalle. */
  const authorOfSelected = selected === null ? null : authorLabel(
    versions.find((v) => v.version === selected) ?? { authorId: null, authorName: null },
  );

  return (
    <aside className="rb-history" aria-label="Historial de versiones">
      <header className="rb-history__header">
        <h3>Historial</h3>
        <button type="button" className="rb-history__close" onClick={onClose} aria-label="Cerrar historial">
          ✕
        </button>
      </header>

      {error && (
        <div className="rb-history__error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="rb-history__empty">Cargando versiones…</p>
      ) : versions.length === 0 ? (
        <p className="rb-history__empty">Este proceso no tiene versiones guardadas.</p>
      ) : (
        <>
          <ol className="rb-history__list">
            {versions.map((v) => {
              const author = authorLabel(v);
              return (
                <li key={v.version}>
                  <button
                    type="button"
                    className={`rb-history__item ${selected === v.version ? "is-selected" : ""}`}
                    onClick={() => setSelected(selected === v.version ? null : v.version)}
                    aria-pressed={selected === v.version}
                  >
                    <span className="rb-history__version">
                      v{v.version}
                      {v.version === currentVersion && <em className="rb-history__current">actual</em>}
                    </span>
                    <span className="rb-history__date">
                      {formatDate(v.createdAt)}
                      {author && <span className="rb-history__author"> · {author}</span>}
                    </span>
                    {v.comment && <span className="rb-history__comment">{v.comment}</span>}
                  </button>
                </li>
              );
            })}
          </ol>

          {selected !== null && (
            <div className="rb-history__detail">
              {loadingDiff ? (
                <p className="rb-history__empty">Calculando cambios…</p>
              ) : diff ? (
                <>
                  <h4>
                    v{selected} · {describeDiff(diff)}
                    {authorOfSelected && <span className="rb-history__detail-author"> · por {authorOfSelected}</span>}
                  </h4>

                  {diff.nodes.length === 0 && diff.edges.length === 0 ? (
                    <p className="rb-history__empty">Esta versión es idéntica a la anterior.</p>
                  ) : (
                    <ul className="rb-history__diff">
                      {diff.nodes.map((change) => (
                        <li key={`n-${change.kind}-${change.node.id}`} className={`rb-diff rb-diff--${change.kind}`}>
                          <span className="rb-diff__icon">
                            {change.kind === "added" ? "+" : change.kind === "removed" ? "−" : change.kind === "moved" ? "↔" : "~"}
                          </span>
                          <span className="rb-diff__label">{change.node.label}</span>
                          {change.fields && change.fields.length > 0 && (
                            <span className="rb-diff__fields">({change.fields.join(", ")})</span>
                          )}
                          {change.previousPosition && (
                            <span className="rb-diff__fields">
                              ({Math.round(change.previousPosition.x)},{Math.round(change.previousPosition.y)} →{" "}
                              {Math.round(change.node.position.x)},{Math.round(change.node.position.y)})
                            </span>
                          )}
                        </li>
                      ))}
                      {diff.edges.map((change) => (
                        <li key={`e-${change.kind}-${change.edge.id}`} className={`rb-diff rb-diff--${change.kind}`}>
                          <span className="rb-diff__icon">{change.kind === "added" ? "+" : "−"}</span>
                          <span className="rb-diff__label">
                            arista {change.edge.source} → {change.edge.target}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {canRestore && selected !== currentVersion && (
                    <button
                      type="button"
                      className="rb-btn rb-btn--secondary rb-btn--block"
                      onClick={() => void handleRestore(selected)}
                      disabled={restoring}
                    >
                      {restoring ? "Restaurando…" : `Restaurar v${selected}`}
                    </button>
                  )}
                  {!canRestore && (
                    <p className="rb-history__hint">Necesitás permiso de editor para restaurar versiones.</p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
