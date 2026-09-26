/**
 * Modal para compartir un proceso (Fase 4).
 *
 * Según el rol del usuario: solo el owner puede invitar/quitar. El server
 * distingue entre invitación directa (el email ya está registrado) e invitación
 * pendiente (el usuario todavía no existe, se le emite un token que puede
 * aceptar al registrarse). Ver `routes/processes.ts`.
 */
import { useCallback, useEffect, useState } from "react";

import { processesApi, type CollaboratorsResponse, type CollaboratorInfo, type PendingInvitation } from "../../lib/api/processes";
import "./ShareModal.css";

interface ShareModalProps {
  processId: string;
  processName: string;
  /** Rol del usuario actual (solo el owner gestiona colaboradores). */
  canManage: boolean;
  onClose: () => void;
}

type Role = "editor" | "viewer";

/** Etiquetas legibles de rol. */
const ROLE_LABEL: Record<CollaboratorInfo["role"], string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Lector",
};

/** Iniciales para el avatar generado. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function ShareModal({ processId, processName, canManage, onClose }: ShareModalProps) {
  const [data, setData] = useState<CollaboratorsResponse | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await processesApi.listCollaborators(processId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los colaboradores");
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInvite = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      setNotice(null);
      setInviteLink(null);

      try {
        const result = await processesApi.invite(processId, email, role);
        if (result.kind === "collaborator") {
          setNotice(`${email} ahora tiene acceso como ${ROLE_LABEL[result.collaborator.role]}.`);
        } else {
          setNotice(`${email} todavía no está registrado. Te dejamos un link de invitación:`);
          setInviteLink(`${window.location.origin}/invitaciones?token=${result.invitation.token}`);
        }
        setEmail("");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo invitar");
      } finally {
        setSubmitting(false);
      }
    },
    [email, role, processId, load],
  );

  const handleRemove = useCallback(
    async (userId: string, name: string) => {
      if (!window.confirm(`¿Quitar a ${name} del proceso? Perderá el acceso.`)) return;
      setError(null);
      try {
        await processesApi.removeCollaborator(processId, userId);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo quitar al colaborador");
      }
    },
    [processId, load],
  );

  const handleCancelInvitation = useCallback(
    async (invitationId: string, invitedEmail: string) => {
      if (!window.confirm(`¿Cancelar la invitación a ${invitedEmail}?`)) return;
      try {
        await processesApi.cancelInvitation(processId, invitationId);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cancelar la invitación");
      }
    },
    [processId, load],
  );

  const collaborators: CollaboratorInfo[] = data?.collaborators ?? [];
  const invitations: PendingInvitation[] = data?.invitations ?? [];

  return (
    <div className="rb-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="rb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rb-modal__header">
          <h2 id="share-modal-title">Compartir “{processName}”</h2>
          <button type="button" className="rb-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        {error && (
          <div className="rb-modal__error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="rb-modal__notice" role="status">
            {notice}
          </div>
        )}
        {inviteLink && (
          <div className="rb-modal__notice">
            <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} aria-label="Link de invitación" />
          </div>
        )}

        {canManage ? (
          <form className="rb-share-form" onSubmit={handleInvite}>
            <input
              type="email"
              placeholder="email@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email del colaborador"
            />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol">
              <option value="editor">Editor</option>
              <option value="viewer">Lector</option>
            </select>
            <button type="submit" className="rb-btn rb-btn--primary" disabled={submitting}>
              {submitting ? "Enviando…" : "Invitar"}
            </button>
          </form>
        ) : (
          <p className="rb-modal__readonly">Solo el owner puede gestionar colaboradores.</p>
        )}

        <section className="rb-share-section">
          <h3>Con acceso ({collaborators.length})</h3>
          {loading ? (
            <p className="rb-modal__loading">Cargando…</p>
          ) : collaborators.length === 0 ? (
            <p className="rb-modal__loading">Todavía no hay nadie más con acceso.</p>
          ) : (
            <ul className="rb-share-list">
              {collaborators.map((c) => (
                <li key={c.userId}>
                  <span className="rb-share-avatar">{initials(c.name)}</span>
                  <span className="rb-share-who">
                    <strong>{c.name}</strong>
                    <small>{c.email}</small>
                  </span>
                  <span className={`rb-role rb-role--${c.role}`}>{ROLE_LABEL[c.role]}</span>
                  {canManage && c.role !== "owner" && (
                    <button
                      type="button"
                      className="rb-share-remove"
                      onClick={() => void handleRemove(c.userId, c.name)}
                      aria-label={`Quitar a ${c.name}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {invitations.length > 0 && (
          <section className="rb-share-section">
            <h3>Invitaciones pendientes ({invitations.length})</h3>
            <ul className="rb-share-list">
              {invitations.map((inv) => (
                <li key={inv.id}>
                  <span className="rb-share-avatar rb-share-avatar--pending">?</span>
                  <span className="rb-share-who">
                    <strong>{inv.email}</strong>
                    <small>expira {formatDate(inv.expiresAt)}</small>
                  </span>
                  <span className={`rb-role rb-role--${inv.role}`}>{ROLE_LABEL[inv.role]}</span>
                  {canManage && (
                    <button
                      type="button"
                      className="rb-share-remove"
                      onClick={() => void handleCancelInvitation(inv.id, inv.email)}
                      aria-label={`Cancelar invitación a ${inv.email}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
