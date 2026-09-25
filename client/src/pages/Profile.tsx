/**
 * Página de perfil (Fase 4).
 * Muestra email, nombre, avatar; permite editar nombre/avatar; botón cerrar sesión.
 */
import { useState } from "react";

import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      await updateProfile({ name: name.trim() || undefined, avatar: avatar.trim() || undefined });
      setMessage({ text: "Perfil actualizado", type: "success" });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Error guardando", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="rb-auth-page">
      <div className="rb-auth-card rb-auth-card--wide">
        <h1>Perfil</h1>
        {message && <div className={`rb-auth-message ${message.type}`}>{message.text}</div>}
        <div className="rb-profile-avatar">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} />
          ) : (
            <span className="rb-avatar-placeholder">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
          )}
        </div>
        <form onSubmit={handleSave}>
          <div className="rb-auth-field">
            <label htmlFor="name">Nombre</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="rb-auth-field">
            <label htmlFor="avatar">Avatar (URL opcional)</label>
            <input
              id="avatar"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <p className="rb-profile-email">Email: {user?.email}</p>
          <button type="submit" className="rb-btn rb-btn--primary rb-btn--block" disabled={loading}>
            {loading ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
        <hr className="rb-auth-divider" />
        <button type="button" className="rb-btn rb-btn--danger rb-btn--block" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}