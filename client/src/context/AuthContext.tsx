/**
 * Contexto de autenticación global (Fase 4).
 *
 * Estado: user, accessToken, isLoading, isAuthenticated.
 * - El access token vive **en memoria** (`lib/api/session.ts`), nunca en
 *   localStorage: si hay XSS lo puede leer igual, pero no persiste.
 * - El refresh token está en una cookie httpOnly del server: al montar, el
 *   provider intenta recuperar la sesión con un `POST /auth/refresh`.
 * - `apiFetch` (ver `lib/api/http.ts`) renueva el token ante cualquier 401, así
 *   que las páginas no tienen que occuparse de esto.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

import { authApi, type User } from "../lib/api/auth";
import { registerTokenListener } from "../lib/api/http";
import { setAccessToken, onSessionExpired } from "../lib/api/session";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; avatar?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!accessToken;

  /** Escribe el token en los dos lugares: estado de React + store de la API. */
  const applyToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setAccessToken(token);
  }, []);

  /** Al montar: intenta recuperar la sesión con la cookie de refresh. */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { accessToken: token } = await authApi.refresh();
        applyToken(token);
        setUser(await authApi.me());
      } catch {
        // Sin sesión válida: se sigue como visitante.
        applyToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void initAuth();
  }, [applyToken]);

  /** `apiFetch` avisa cuando renueva el token por su cuenta. */
  useEffect(() => registerTokenListener((token) => setAccessTokenState(token)), []);

  /** Si el refresh falla en cualquier request, se limpia la sesión. */
  useEffect(
    () =>
      onSessionExpired(() => {
        setAccessTokenState(null);
        setUser(null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }),
    [],
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const { user: userData, accessToken: token } = await authApi.login(input);
      applyToken(token);
      setUser(userData);
    },
    [applyToken],
  );

  const register = useCallback(
    async (input: { email: string; password: string; name: string }) => {
      const { user: userData, accessToken: token } = await authApi.register(input);
      applyToken(token);
      setUser(userData);
    },
    [applyToken],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Aunque el server falle, en el cliente la sesión se corta igual.
      applyToken(null);
      setUser(null);
      window.location.href = "/login";
    }
  }, [applyToken]);

  const updateProfile = useCallback(async (input: { name?: string; avatar?: string }) => {
    setUser(await authApi.updateProfile(input));
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook para usar el contexto de auth. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
