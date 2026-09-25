/**
 * Rutas de la API de procesos (Fase 3 + 4).
 * CRUD + versionado + validación + auth + permisos + colaboradores.
 */
import { Router, Request, Response, NextFunction } from "express";

import { createStore } from "../db/processStore.js";
import { validateProcess, type ValidationIssue } from "@shared/validation/validateProcess.js";
import { authRequired } from "../middleware/auth.js";
import type { ProcessModel } from "@shared/model/types.js";

const router = Router();
const store = createStore();

/** Helper: extrae parámetro :id como string. */
function getIdParam(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
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

    const { meta, collaborator } = store.create(
      { name: name.trim(), model: model as ProcessModel, comment, ownerId: req.user!.id }
    );
    res.status(201).json({ ...meta, collaborator });
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes ---
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string | undefined;
    const list = store.list(req.user!.id, q ? { q } : undefined);
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes/:id ---
router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
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
    const id = getIdParam(req);
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
    const id = getIdParam(req);
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
    const id = getIdParam(req);
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
    const id = getIdParam(req);
    const vParam = req.params.v;
    const versionStr = Array.isArray(vParam) ? vParam[0] : vParam;
    const versionNum = parseInt(versionStr, 10);
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

// --- Colaboradores ---

// GET /api/processes/:id/collaborators
router.get("/:id/collaborators", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");

    const collaborators = store.getCollaborators(id);
    res.json(collaborators);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// POST /api/processes/:id/collaborators
router.post("/:id/collaborators", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const { email, role } = req.body as { email?: string; role?: "editor" | "viewer" };

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email obligatorio" });
    }
    if (!role || !["editor", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Rol debe ser 'editor' o 'viewer'" });
    }

    // Buscar usuario por email
    const authStore = require("../db/authStore.js").createAuthStore();
    const targetUser = authStore.findByEmail(email);
    authStore.close();

    if (!targetUser) {
      // Usuario no existe → crear invitación (simulada)
      return res.status(404).json({ error: "Usuario no encontrado. Invítalo a registrarse primero." });
    }

    // Verificar que no sea el owner actual
    const meta = store.getMeta(req.user!.id, id);
    if (!meta) return notFound(res, "Proceso");
    if (meta.ownerId === targetUser.id) {
      return res.status(400).json({ error: "El owner ya tiene acceso" });
    }

    const collaborator = store.addCollaborator(req.user!.id, getIdParam(req), targetUser.id, role);
    res.status(201).json({ collaborator });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden(res);
    next(e);
  }
});

// DELETE /api/processes/:id/collaborators/:userId
router.delete("/:id/collaborators/:userId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const targetUserId = getIdParam(req); // req.params.userId

    const deleted = store.removeCollaborator(req.user!.id, id, targetUserId);
    if (!deleted) return notFound(res, "Colaborador");
    res.status(204).send();
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "FORBIDDEN") return forbidden(res);
      if (e.message === "CANNOT_REMOVE_OWNER") return res.status(400).json({ error: "No se puede quitar al owner" });
    }
    next(e);
  }
});

export { router as processesRouter };