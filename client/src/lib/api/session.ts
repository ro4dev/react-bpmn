/**
 * Estado de sesión en memoria (Fase 4).
 *
 * Vive en un módulo aparte de React a propósito: las capas de API necesitan
 * leer/escribir el access token sin depender de un hook, y así no se rompe si
 * una request se dispara desde un event handler fuera de un componente.
 *
 * El token NO se persiste: al recargar la página se recupera con un
 * `POST /auth/refresh` usando la cookie httpOnly.
 */

let accessToken: string | null = null;

type ExpiredHandler = () => void;
const expiredHandlers = new Set<ExpiredHandler>();

/** Setea el access token en memoria (null para cerrar sesión). */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Lee el access token actual. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Registra un handler para "la sesión no se pudo renovar". Devuelve el cleanup. */
export function onSessionExpired(handler: ExpiredHandler): () => void {
  expiredHandlers.add(handler);
  return () => expiredHandlers.delete(handler);
}

/** Avisa a todos los handlers que la sesión murió (usado por `apiFetch`). */
export function notifySessionExpired(): void {
  accessToken = null;
  for (const handler of expiredHandlers) handler();
}
