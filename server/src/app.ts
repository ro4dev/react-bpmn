/**
 * Configuración de la aplicación Express:
 * - CORS habilitado (para desarrollo con el client en otro puerto).
 * - Parseo de JSON en el body.
 * - Cookie parser para refresh tokens.
 * - Rutas montadas bajo el prefijo `/api`.
 */
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";

import { healthRouter } from "./routes/health.js";
import { processesRouter } from "./routes/processes.js";
import { authRouter } from "./routes/auth.js";
import { invitationsRouter } from "./routes/invitations.js";
import { roleCache } from "./middleware/roleCache.js";

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
// Antes de las rutas que chequean permisos: memoiza `roleOf` durante el request.
app.use(roleCache);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/processes", processesRouter);
app.use("/api/invitations", invitationsRouter);

// 404 para rutas no definidas
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});