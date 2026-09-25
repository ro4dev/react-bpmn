/**
 * Cliente HTTP tipado para la API de procesos (Fase 3).
 * Base URL: /api (proxied por Vite a localhost:4000 en dev).
 */
import type { ProcessModel } from "@shared/model/types";
import type { ValidationIssue } from "@shared/validation/validateProcess";

const API_BASE = "/api/processes";

export interface ProcessMeta {
  id: string;
  name: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
  preview: string;
  status: "válido" | "con-errores" | "con-advertencias" | "vacío";
}

export interface ProcessVersionMeta {
  version: number;
  comment: string | null;
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

export interface ApiError {
  error: string;
  issues?: ValidationIssue[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(error.error, { cause: error });
  }
  return response.json() as Promise<T>;
}

export const processesApi = {
  /** POST /api/processes */
  async create(input: CreateProcessInput): Promise<ProcessMeta> {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleResponse(res);
  },

  /** GET /api/processes?q= */
  async list(q?: string): Promise<ProcessMeta[]> {
    const url = q ? `${API_BASE}?q=${encodeURIComponent(q)}` : API_BASE;
    const res = await fetch(url);
    return handleResponse(res);
  },

  /** GET /api/processes/:id */
  async get(id: string): Promise<ProcessFull> {
    const res = await fetch(`${API_BASE}/${id}`);
    return handleResponse(res);
  },

  /** PUT /api/processes/:id */
  async update(id: string, input: UpdateProcessInput): Promise<ProcessMeta> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleResponse(res);
  },

  /** DELETE /api/processes/:id */
  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("No se pudo eliminar");
  },

  /** GET /api/processes/:id/versions */
  async listVersions(id: string): Promise<ProcessVersionMeta[]> {
    const res = await fetch(`${API_BASE}/${id}/versions`);
    return handleResponse(res);
  },

  /** GET /api/processes/:id/versions/:v */
  async getVersion(id: string, version: number): Promise<ProcessVersionFull> {
    const res = await fetch(`${API_BASE}/${id}/versions/${version}`);
    return handleResponse(res);
  },
};