/**
 * Página de login (Fase 4).
 * Formulario email/password, validación client-side, llama auth.login.
 *
 * Incluye acceso rápido a los usuarios del seed (`npm run seed`): no es un
 * bypass de auth, son el login normal con credenciales conocidas, para poder
 * recorrer la app en local sin registrar usuario a mano.
 */
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

/** Mismas credenciales que crea `server/src/db/seed.ts` (DEMO_PASSWORD). */
const DEMO_ACCOUNTS = [
  { email: "ana@demo.local", label: "Ana", role: "owner · 100 procesos de negocio" },
  { email: "bruno@demo.local", label: "Bruno", role: "editor y viewer · vista por rol" },
];
const DEMO_PASSWORD = "demo1234";

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

  /** Acceso rápido: rellena el formulario con una cuenta demo. */
  const handleDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError("");
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

        <hr className="rb-auth-divider" />

        <div className="rb-auth-demo">
          <p className="rb-auth-demo-title">Acceso rápido (datos de prueba)</p>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="rb-auth-demo-btn"
              onClick={() => handleDemo(account.email)}
              disabled={loading}
            >
              <strong>{account.label}</strong>
              <span>{account.role}</span>
            </button>
          ))}
          <p className="rb-auth-demo-hint">
            Corré <code>npm run seed</code> en la raíz para crear estas cuentas.
          </p>
        </div>

        <p className="rb-auth-link">
          ¿No tenés cuenta? <Link to="/register">Registrate</Link>
        </p>
      </div>
    </div>
  );
}
