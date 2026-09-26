/**
 * Middleware que abre la caché de roles del request (Fase 4).
 *
 * Debe montarse **antes** de cualquier ruta que consulte permisos, para que el
 * store cachee durante todo el handler. Ver `db/roleCache.ts` para el porqué de
 * no usar un `Map` en el store.
 */
import { RequestHandler } from "express";

import { runWithRoleCache } from "../db/roleCache.js";

export const roleCache: RequestHandler = (_req, _res, next) => {
  runWithRoleCache(next);
};
