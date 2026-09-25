/**
 * Página de login (Fase 4).
 * Formulario email/password, validación client-side, llama auth.login.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rb-auth-page">
      <div className="rb-auth-card">
        <h1>Iniciar sesión</h1>
        {error && <div className="rb-auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
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
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <button type="submit" className="rb-btn rb-btn--primary rb-btn--block" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="rb-auth-link">
          ¿No tenés cuenta? <Link to="/register">Registrate</Link>
        </p>
      </div>
    </div>
  );
}