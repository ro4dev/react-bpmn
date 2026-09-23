/**
 * Configuración de la aplicación Express:
 * - CORS habilitado (para desarrollo con el client en otro puerto).
 * - Parseo de JSON en el body.
 * - Rutas montadas bajo el prefijo `/api`.
 */
import cors from "cors";
import express from "express";

import { healthRouter } from "./routes/health.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);

// 404 para rutas no definidas
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});