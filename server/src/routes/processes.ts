/**
 * Rutas de la API de procesos (Fase 3).
 * CRUD + versionado + validación server-side con validateProcess compartido.
 */
import { Router, Request, Response, NextFunction } from "express";

import { createStore } from "../db/processStore.js";
import { validateProcess, type ValidationIssue } from "@shared/validation/validateProcess.js";
import type { ProcessModel } from "@shared/model/types.js";

const router = Router();
const store = createStore();

/** Helper: extrae parámetro :id como string (Express 5 puede dar string | string[]). */
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

    const created = store.create({ name: name.trim(), model: model as ProcessModel, comment });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes ---
router.get("/", (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = store.list();
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes/:id ---
router.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const meta = store.getMeta(id);
    if (!meta) return notFound(res, "Proceso");

    const model = store.getLatestModel(id);
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

    // Verificar que existe
    const existing = store.getMeta(id);
    if (!existing) return notFound(res, "Proceso");

    // Si viene modelo, validarlo
    if (model !== undefined) {
      const issues = validateProcess(model as ProcessModel);
      const errors = issues.filter((i) => i.severity === "error");
      if (errors.length > 0) {
        return validationError(res, issues);
      }
    }

    const updated = store.update(id, {
      name: name?.trim(),
      model: model as ProcessModel | undefined,
      comment,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// --- DELETE /api/processes/:id ---
router.delete("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const deleted = store.delete(id);
    if (!deleted) return notFound(res, "Proceso");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// --- GET /api/processes/:id/versions ---
router.get("/:id/versions", (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getIdParam(req);
    const meta = store.getMeta(id);
    if (!meta) return notFound(res, "Proceso");

    const versions = store.listVersions(id);
    res.json(versions);
  } catch (e) {
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

    const meta = store.getMeta(id);
    if (!meta) return notFound(res, "Proceso");

    const version = store.getVersion(id, versionNum);
    if (!version) return notFound(res, "Versión");

    res.json(version);
  } catch (e) {
    next(e);
  }
});

export { router as processesRouter, store };