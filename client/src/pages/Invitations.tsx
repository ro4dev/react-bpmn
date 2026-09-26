/**
 * Página de invitaciones (Fase 4).
 *
 * Muestra las invitaciones dirigidas al email del usuario actual y permite
 * aceptarlas. También acepta un `?token=...` (el link que genera el owner al
 * invitar a alguien que todavía no está registrado), que se auto-acepta si el
 * usuario ya está logueado con el email correcto.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { authApi, type MyInvitation } from "../lib/api/auth";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export function Invitations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const token = searchParams.get("token");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvitations(await authApi.myInvitations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las invitaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  const accept = useCallback(
    async (invitationToken: string) => {
      setBusyId(invitationToken);
      setError(null);
      setNotice(null);
      try {
        await authApi.acceptInvitation(invitationToken);
        setNotice("Invitación aceptada. Ya tenés acceso al proceso.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo aceptar la invitación");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  // Si viene un token por URL, se acepta directo (el usuario ya está autenticado
  // porque esta ruta es protegida).
  useEffect(() => {
    if (!token) return;
    void accept(token);
  }, [token, accept]);

  return (
    <div className="rb-auth-page">
      <div className="rb-auth-card rb-auth-card--wide">
        <h1>Invitaciones</h1>

        {error && <div className="rb-auth-error">{error}</div>}
        {notice && <div className="rb-auth-message success">{notice}</div>}

        {loading ? (
          <p className="rb-profile-email">Cargando…</p>
        ) : invitations.length === 0 ? (
          <p className="rb-profile-email">
            No tenés invitaciones pendientes para {user?.email}.
          </p>
        ) : (
          <ul className="rb-invitations">
            {invitations.map((inv) => (
              <li key={inv.id} className="rb-invitation">
                <div>
                  <strong>{inv.processName}</strong>
                  <small>
                    como {inv.role === "editor" ? "Editor" : "Lector"} · expira{" "}
                    {new Date(inv.expiresAt).toLocaleDateString("es-AR")}
                  </small>
                </div>
                {inv.alreadyAccepted ? (
                  <span className="rb-role rb-role--owner">Ya sos colaborador</span>
                ) : (
                  <button
                    type="button"
                    className="rb-btn rb-btn--primary rb-btn--small"
                    onClick={() => void accept(inv.token)}
                    disabled={busyId === inv.token}
                  >
                    {busyId === inv.token ? "Aceptando…" : "Aceptar"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="rb-btn rb-btn--secondary rb-btn--block"
          onClick={() => navigate("/")}
        >
          Volver a mis procesos
        </button>
      </div>
    </div>
  );
}
