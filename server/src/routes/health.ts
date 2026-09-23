/**
 * Ruta de salud: permite verificar que la API está viva.
 * GET /api/health -> { status: "ok", timestamp: <ISO> }
 */
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});