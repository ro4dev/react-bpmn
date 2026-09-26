/**
 * Rutas de la API de procesos (Fase 3 + 4).
 * CRUD + versionado + validación + auth + permisos + colaboradores + invitaciones.
 */
import { Router, Request, Response, NextFunction } from "express";

import { getAuthStore } from "../db/singleton.js";
import { getProcessStore } from "../db/singleton.js";
import { validateProcess, type ValidationIssue } from "../../../shared/src/validation/validateProcess.js";
import { authRequired } from "../middleware/auth.js";
import type { ProcessModel } from "../../../shared/src/model/types.js";

const router = Router();
const store = getProcessStore();
const authStore = getAuthStore();

/** Helper: extrae parámetro de ruta como string (Express 5 lo tipa `string | string[]`). */
function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Helper: respuesta de error de validación (400). */
function validationError(res: Response, issues: ValidationIssue[]): void {
  res.status(400).json({ error: "Modelo inválido", issues });
}

/** Helper: respuesta 404. */
function notFound(res: Response, resource: string): void {
  res.status(404).json({ error: `${resource} no encontrado` });
}

/** Helper: respuesta 403. */
function forbidden(res: Response, message = "Permiso insuficiente"): void {
  res.status(403).json({ error: message });
}

/** Middleware: requiere autenticación en todas las rutas de procesos. */
router.use(authRequired);

// --- POST /api/processes ---
router.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, model, comment } = req.body as {
      name?: string;
      model?: unknown;
      comment?: string;
    };

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "El campo 'name' es obligatorio" });
    }
    if (!model) {
      return res.status(400).json({ error: "El campo 'model' es obligatorio" });
    }

    // Validar modelo con lógica compartida
    const issues = validateProcess(model as ProcessModel);
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      return validationError(res, issues);
    }

    const { meta, collaborator } = store.create({
      name: name.trim(),
      model: model as ProcessModel,
      comment,
      ownerId: req.user!.id,
      authorName: req.user!.name,
    });
    res.status(201).json({ ...meta, collaborator });
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes ---
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string | undefined;
    const scope = req.query.scope as string | undefined;
    const list = store.list(req.user!.id, q ? { q } : undefined);

    // `scope=mine` oculta lo compartido; el resto son filtros de UI.
    const filtered =
      scope === "mine" ? list.filter((p) => p.role === "owner") : list;

    res.json(filtered);
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes/:id ---
router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");

    const model = store.getLatestModel(req.user!.id, id);
    res.json({ ...meta, model });
  } catch (e) {
    next(e);
  }
});

// --- PUT /api/processes/:id ---
router.put("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const { name, model, comment } = req.body as {
      name?: string;
      model?: unknown;
      comment?: string;
    };

    // Validar modelo si viene
    if (model !== undefined) {
      const issues = validateProcess(model as ProcessModel);
      const errors = issues.filter((i) => i.severity === "error");
      if (errors.length > 0) {
        return validationError(res, issues);
      }
    }

    const updated = store.update(req.user!.id, id, {
      name: name?.trim(),
      model: model as ProcessModel | undefined,
      comment,
      authorName: req.user!.name,
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// --- DELETE /api/processes/:id ---
router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const deleted = store.delete(req.user!.id, id);
    if (!deleted) return notFound(res, "Proceso");
    res.status(204).send();
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// --- GET /api/processes/:id/versions ---
router.get("/:id/versions", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");

    const versions = store.listVersions(req.user!.id, id);
    res.json(versions);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// --- GET /api/processes/:id/versions/:v ---
router.get("/:id/versions/:v", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const versionNum = parseInt(getParam(req, "v"), 10);
    if (isNaN(versionNum)) {
      return res.status(400).json({ error: "Versión inválida" });
    }

    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");

    const version = store.getVersion(req.user!.id, id, versionNum);
    if (!version) return notFound(res, "Versión");

    res.json(version);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// --- POST /api/processes/:id/versions/:v/restore ---
// Restaurar = crear una versión N+1 con el modelo de la versión N.
// El historial es inmutable: nada se sobrescribe, se agrega.
router.post("/:id/versions/:v/restore", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const versionNum = parseInt(getParam(req, "v"), 10);
    if (isNaN(versionNum)) {
      return res.status(400).json({ error: "Versión inválida" });
    }

    const version = store.getVersion(req.user!.id, id, versionNum);
    if (!version) return notFound(res, "Versión");

    const updated = store.update(req.user!.id, id, {
      model: version.model,
      comment: `Restaurado desde v${versionNum}`,
      authorName: req.user!.name,
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return forbidden(res, "Necesitás permiso de editor para restaurar versiones");
    }
    next(e);
  }
});

// --- Colaboradores ---

// GET /api/processes/:id/collaborators
router.get("/:id/collaborators", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");

    res.json({
      collaborators: store.getCollaborators(id),
      invitations: authStore.listInvitations(id),
      canManage: meta.role === "owner",
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/processes/:id/collaborators
// Si el email ya está registrado → colaborador directo.
// Si no → invitación con token (el alta real ocurre al aceptarla).
router.post("/:id/collaborators", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const { email, role } = req.body as { email?: string; role?: "editor" | "viewer" };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (!role || !["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Rol debe ser 'editor' o 'viewer'" });
    }

    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");
    if (meta.role !== "owner") {
      return forbidden(res, "Solo el owner puede invitar colaboradores");
    }

    const emailNorm = email.trim().toLowerCase();
    if (emailNorm === req.user!.email) {
      return res.status(400).json({ error: "No podés invitarte a vos mismo" });
    }

    // Usuario registrado → colaborador directo.
    const targetUser = authStore.findByEmail(emailNorm);
    if (targetUser) {
      if (targetUser.id === meta.ownerId) {
        return res.status(400).json({ error: "El owner ya tiene acceso" });
      }
      const collaborator = store.addCollaborator(req.user!.id, id, targetUser.id, role);
      // Si tenía una invitación viva para ese proceso, ya no aplica.
      for (const inv of authStore.listInvitations(id)) {
        if (inv.email === emailNorm) {
          authStore.invalidateInvitation(inv.id);
        }
      }
      return res.status(201).json({ kind: "collaborator", collaborator });
    }

    // Usuario inexistente → invitación con token firmado.
    const invitation = authStore.createInvitation(emailNorm, id, role, {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      avatar: null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ kind: "invitation", invitation });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// DELETE /api/processes/:id/collaborators/:userId
router.delete("/:id/collaborators/:userId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const targetUserId = getParam(req, "userId");

    const deleted = store.removeCollaborator(req.user!.id, id, targetUserId);
    if (!deleted) return notFound(res, "Colaborador");
    res.status(204).send();
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "FORBIDDEN") return forbidden(res, "Solo el owner puede quitar colaboradores");
      if (e.message === "CANNOT_REMOVE_OWNER") return res.status(400).json({ error: "No se puede quitar al owner" });
    }
    next(e);
  }
});

// DELETE /api/processes/:id/invitations/:invitationId
router.delete("/:id/invitations/:invitationId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req, "id");
    const invitationId = getParam(req, "invitationId");

    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");
    if (meta.role !== "owner") return forbidden(res, "Solo el owner puede cancelar invitaciones");

    const deleted = authStore.deleteInvitation(id, invitationId);
    if (!deleted) return notFound(res, "Invitación");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export { router as processesRouter };
