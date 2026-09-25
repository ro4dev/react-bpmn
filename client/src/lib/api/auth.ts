/**
 * Cliente HTTP tipado para la API de autenticación (Fase 4).
 * Base URL: /api (proxied por Vite a localhost:4000 en dev).
 */
import type { User } from "@shared/model/types";

export type { User } from "@shared/model/types";

const API_BASE = "/api/auth";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatar?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ApiError {
  error: string;
  issues?: string[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(error.error, { cause: error });
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  /** POST /api/auth/register */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return handleResponse(res);
  },

  /** POST /api/auth/login */
  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return handleResponse(res);
  },

  /** POST /api/auth/refresh */
  async refresh(): Promise<{ accessToken: string }> {
    const res = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /** GET /api/auth/me */
  async me(): Promise<User> {
    const res = await fetch(`${API_BASE}/me`, {
      credentials: "include",
    });
    return handleResponse(res);
  },

  /** PUT /api/auth/me */
  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const res = await fetch(`${API_BASE}/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return handleResponse(res);
  },

  /** POST /api/auth/logout */
  async logout(): Promise<void> {
    const res = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("No se pudo cerrar sesión");
  },
};