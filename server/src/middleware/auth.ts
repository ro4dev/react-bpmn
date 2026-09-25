/**
 * Middleware de autenticación JWT (Fase 4).
 * Valida access token y adjunta `req.user` con { id, email, name }.
 */
import { Request, Response, NextFunction } from "express";

import { createAuthStore } from "../db/authStore.js";

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

/** Middleware: requiere autenticación válida. */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const authStoreLocal = createAuthStore();
  const payload = authStoreLocal.verifyAccessToken(token);
  authStoreLocal.close();

  if (!payload) {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  req.user = { id: payload.sub, email: payload.email, name: payload.name };
  next();
}

/** Middleware: autenticación opcional (no falla si no hay token). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next();

  const authStoreLocal = createAuthStore();
  const payload = authStoreLocal.verifyAccessToken(token);
  authStoreLocal.close();

  if (payload) {
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
  }
  next();
}