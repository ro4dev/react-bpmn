/**
 * Cliente HTTP tipado para la API de procesos (Fases 3 y 4).
 * Todas las requests pasan por `apiFetch`, que inyecta el access token y
 * renueva la sesión ante un 401.
 */
import type { ProcessModel, Role } from "@shared/model/types";

import { apiJson, apiNoContent } from "./http";

const API_BASE = "/api/processes";

export interface ProcessMeta {
  id: string;
  name: string;
  currentVersion: number;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  preview: string;
  status: "válido" | "con-errores" | "con-advertencias" | "vacío";
  /** Rol del usuario actual sobre el proceso. */
  role: Role;
}

export interface ProcessVersionMeta {
  version: number;
  comment: string | null;
  /** Quién guardó la versión. `authorId` es null si el usuario fue borrado. */
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface ProcessFull extends ProcessMeta {
  model: ProcessModel;
}

export interface ProcessVersionFull {
  id: number;
  processId: string;
  version: number;
  model: ProcessModel;
  comment: string | null;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface CreateProcessInput {
  name: string;
  model: ProcessModel;
  comment?: string;
}

export interface UpdateProcessInput {
  name?: string;
  model?: ProcessModel;
  comment?: string;
}

/** Colaborador con datos de usuario (para el panel de compartir). */
export interface CollaboratorInfo {
  userId: string;
  email: string;
  name: string;
  role: Role;
  invitedAt: string;
}

/** Invitación pendiente (el usuario invitado todavía no se registró). */
export interface PendingInvitation {
  id: string;
  email: string;
  role: Exclude<Role, "owner">;
  expiresAt: string;
  createdAt: string;
}

export interface CollaboratorsResponse {
  collaborators: CollaboratorInfo[];
  invitations: PendingInvitation[];
  canManage: boolean;
}

export type ShareResult =
  | { kind: "collaborator"; collaborator: { processId: string; userId: string; role: Exclude<Role, "owner">; invitedAt: string } }
  | { kind: "invitation"; invitation: { id: string; email: string; processId: string; role: Exclude<Role, "owner">; token: string; expiresAt: string; createdAt: string } };

export const processesApi = {
  /** POST /api/processes */
  async create(input: CreateProcessInput): Promise<ProcessMeta> {
    return apiJson<ProcessMeta>(API_BASE, { method: "POST", body: input });
  },

  /** GET /api/processes?q=&scope= */
  async list(q?: string, scope?: "mine" | "all"): Promise<ProcessMeta[]> {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (scope) params.set("scope", scope);
    const query = params.toString();
    return apiJson<ProcessMeta[]>(query ? `${API_BASE}?${query}` : API_BASE);
  },

  /** GET /api/processes/:id */
  async get(id: string): Promise<ProcessFull> {
    return apiJson<ProcessFull>(`${API_BASE}/${id}`);
  },

  /** PUT /api/processes/:id */
  async update(id: string, input: UpdateProcessInput): Promise<ProcessMeta> {
    return apiJson<ProcessMeta>(`${API_BASE}/${id}`, { method: "PUT", body: input });
  },

  /** DELETE /api/processes/:id */
  async delete(id: string): Promise<void> {
    await apiNoContent(`${API_BASE}/${id}`, { method: "DELETE" });
  },

  // --- Versiones ---

  /** GET /api/processes/:id/versions */
  async listVersions(id: string): Promise<ProcessVersionMeta[]> {
    return apiJson<ProcessVersionMeta[]>(`${API_BASE}/${id}/versions`);
  },

  /** GET /api/processes/:id/versions/:v */
  async getVersion(id: string, version: number): Promise<ProcessVersionFull> {
    return apiJson<ProcessVersionFull>(`${API_BASE}/${id}/versions/${version}`);
  },

  /**
   * POST /api/processes/:id/versions/:v/restore
   * Restaura creando una versión nueva (el historial es inmutable).
   */
  async restoreVersion(id: string, version: number): Promise<ProcessMeta> {
    return apiJson<ProcessMeta>(`${API_BASE}/${id}/versions/${version}/restore`, {
      method: "POST",
      body: {},
    });
  },

  // --- Colaboradores (Fase 4) ---

  /** GET /api/processes/:id/collaborators */
  async listCollaborators(id: string): Promise<CollaboratorsResponse> {
    return apiJson<CollaboratorsResponse>(`${API_BASE}/${id}/collaborators`);
  },

  /** POST /api/processes/:id/collaborators — invita por email. */
  async invite(id: string, email: string, role: Exclude<Role, "owner">): Promise<ShareResult> {
    return apiJson<ShareResult>(`${API_BASE}/${id}/collaborators`, {
      method: "POST",
      body: { email, role },
    });
  },

  /** DELETE /api/processes/:id/collaborators/:userId */
  async removeCollaborator(id: string, userId: string): Promise<void> {
    await apiNoContent(`${API_BASE}/${id}/collaborators/${userId}`, { method: "DELETE" });
  },

  /** DELETE /api/processes/:id/invitations/:invitationId */
  async cancelInvitation(id: string, invitationId: string): Promise<void> {
    await apiNoContent(`${API_BASE}/${id}/invitations/${invitationId}`, { method: "DELETE" });
  },
};
