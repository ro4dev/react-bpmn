/**
 * Página de registro (Fase 4).
 * Formulario email/password/name, validación, llama auth.register.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register({ email, password, name });
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rb-auth-page">
      <div className="rb-auth-card">
        <h1>Crear cuenta</h1>
        {error && <div className="rb-auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="rb-auth-field">
            <label htmlFor="name">Nombre</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              disabled={loading}
            />
          </div>
          <div className="rb-auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="rb-auth-field">
            <label htmlFor="password">Contraseña (mín. 8 caracteres)</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <button type="submit" className="rb-btn rb-btn--primary rb-btn--block" disabled={loading}>
            {loading ? "Registrando…" : "Registrarse"}
          </button>
        </form>
        <p className="rb-auth-link">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}