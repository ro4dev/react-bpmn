/**
 * Cliente HTTP tipado para la API de autenticación (Fase 4).
 * Todas las requests pasan por `apiFetch`, que inyecta el access token.
 */
import type { User } from "@shared/model/types";

import { apiJson, apiNoContent } from "./http";

const AUTH_BASE = "/api/auth";
const INVITATIONS_BASE = "/api/invitations";

export type { User };

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

/** Respuesta de register/login: usuario + access token (el refresh va en cookie). */
export interface AuthResponse {
  user: User;
  accessToken: string;
}

/** Invitación dirigida al usuario actual, pendiente de aceptar. */
export interface MyInvitation {
  id: string;
  email: string;
  processId: string;
  processName: string;
  role: "editor" | "viewer";
  /** Token de aceptación (el server lo devuelve porque el email ya coincide). */
  token: string;
  expiresAt: string;
  createdAt: string;
  alreadyAccepted: boolean;
}

export const authApi = {
  /** POST /api/auth/register */
  async register(input: RegisterInput): Promise<AuthResponse> {
    return apiJson<AuthResponse>(`${AUTH_BASE}/register`, { method: "POST", body: input });
  },

  /** POST /api/auth/login */
  async login(input: LoginInput): Promise<AuthResponse> {
    return apiJson<AuthResponse>(`${AUTH_BASE}/login`, { method: "POST", body: input });
  },

  /** POST /api/auth/refresh — renueva el access token con la cookie httpOnly. */
  async refresh(): Promise<{ accessToken: string }> {
    return apiJson<{ accessToken: string }>(`${AUTH_BASE}/refresh`, {
      method: "POST",
      skipAuthRetry: true,
    });
  },

  /** GET /api/auth/me */
  async me(): Promise<User> {
    return apiJson<User>(`${AUTH_BASE}/me`);
  },

  /** PUT /api/auth/me */
  async updateProfile(input: UpdateProfileInput): Promise<User> {
    return apiJson<User>(`${AUTH_BASE}/me`, { method: "PUT", body: input });
  },

  /** POST /api/auth/logout */
  async logout(): Promise<void> {
    await apiNoContent(`${AUTH_BASE}/logout`, { method: "POST" });
  },

  /** GET /api/invitations/mine — invitaciones pendientes para mi email. */
  async myInvitations(): Promise<MyInvitation[]> {
    return apiJson<MyInvitation[]>(`${INVITATIONS_BASE}/mine`);
  },

  /** POST /api/invitations/accept */
  async acceptInvitation(token: string): Promise<{ collaborator: { processId: string; userId: string; role: string; invitedAt: string } }> {
    return apiJson(`${INVITATIONS_BASE}/accept`, { method: "POST", body: { token } });
  },
};
