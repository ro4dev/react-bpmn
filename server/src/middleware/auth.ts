/**
 * Middleware de autenticación JWT (Fase 4).
 * Valida access token y adjunta `req.user` con { id, email, name }.
 */
import { Request, Response, NextFunction } from "express";

import { getAuthStore } from "../db/singleton.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Extrae token del header Authorization: Bearer <token>. */
function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/** Adjunta `req.user` si el token es válido; si no, no hace nada. */
function attachUser(req: Request): void {
  const token = extractToken(req);
  if (!token) return;

  const payload = getAuthStore().verifyAccessToken(token);
  if (payload) {
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
  }
}

/** Middleware: requiere autenticación válida (401 si falta o el token no sirve). */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  if (!extractToken(req)) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  attachUser(req);
  if (!req.user) {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  next();
}

/** Middleware: autenticación opcional (no falla si no hay token o es inválido). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  attachUser(req);
  next();
}