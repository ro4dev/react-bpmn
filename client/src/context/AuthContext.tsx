/**
 * Contexto de autenticación global (Fase 4).
 * Estado: user, accessToken, isLoading, isAuthenticated.
 * accessToken en memoria (variable), refresh token en httpOnly cookie (server).
 * Maneja 401 → refresh automático → retry.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

import { authApi, type User } from "../lib/api/auth";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; avatar?: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!accessToken;

  /** Inicializa: intenta recuperar sesión con refresh token. */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { accessToken: newAccessToken } = await authApi.refresh();
        setAccessToken(newAccessToken);
        const userData = await authApi.me();
        setUser(userData);
      } catch {
        // Sin sesión válida
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const { user: userData, accessToken: newAccessToken } = await authApi.login(input);
    setUser(userData);
    setAccessToken(newAccessToken);
  }, []);

  const register = useCallback(async (input: { email: string; password: string; name: string }) => {
    const { user: userData, accessToken: newAccessToken } = await authApi.register(input);
    setUser(userData);
    setAccessToken(newAccessToken);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setAccessToken(null);
    window.location.href = "/login";
  }, []);

  const updateProfile = useCallback(async (input: { name?: string; avatar?: string }) => {
    const updatedUser = await authApi.updateProfile(input);
    setUser(updatedUser);
  }, []);

  const refresh = useCallback(async () => {
    const { accessToken: newAccessToken } = await authApi.refresh();
    setAccessToken(newAccessToken);
    const userData = await authApi.me();
    setUser(userData);
  }, [accessToken]);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
    refresh,
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