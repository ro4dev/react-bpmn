/**
 * Cliente HTTP común (Fase 4).
 *
 * Concentra tres cosas que si no se repetirían en cada api.ts:
 *  1. el access token vive **en memoria** (nunca en localStorage: cualquier
 *     XSS se lo lleva igual, pero al menos no persiste entre sesiones);
 *  2. el refresh token viaja en cookie httpOnly (inaccesible para JS), así que
 *     renovar sesión es un `POST /api/auth/refresh` sin arguments;
 *  3. un 401 dispara **un solo** refresh y reintenta la request original, de
 *     forma transparente para la UI.
 */
import { getAccessToken, setAccessToken, notifySessionExpired } from "./session";

export interface ApiErrorBody {
  error?: string;
  issues?: unknown;
}

/** Error de API con el status HTTP y el body parseado. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

/** Callback registrado por AuthContext para recibir el access token renovado. */
let onTokenRefreshed: ((token: string) => void) | null = null;

/** Permite que AuthContext se entere de los refrescos hechos acá. */
export function registerTokenListener(fn: (token: string) => void): void {
  onTokenRefreshed = fn;
}

/** Lee un error del body de la respuesta. */
async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return new ApiError(
    body.error ?? `Error ${response.status}`,
    response.status,
    body.issues,
  );
}

/** Refresh en curso, para no disparar N refrescos ante N requests en paralelo. */
let refreshInFlight: Promise<string> | null = null;

/**
 * Renueva el access token usando la cookie httpOnly.
 * Deduplica: si hay varias requests esperando, todas comparten el mismo refresh.
 */
export function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw await toApiError(res);

    const { accessToken } = (await res.json()) as { accessToken: string };
    setAccessToken(accessToken);
    onTokenRefreshed?.(accessToken);
    return accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** No intentar refresh + retry (para /auth/refresh mismo). */
  skipAuthRetry?: boolean;
}

/** Fetch con Authorization + credentials + refresh automático ante 401. */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { body, skipAuthRetry, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);

  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const send = (): Promise<Response> =>
    fetch(path, {
      ...rest,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const response = await send();

  if (response.status === 401 && !skipAuthRetry) {
    try {
      await refreshAccessToken();
    } catch {
      notifySessionExpired();
      throw await toApiError(response);
    }
    return send();
  }

  return response;
}

/** apiFetch + parseo del body como JSON. */
export async function apiJson<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

/** apiFetch esperando 204 (sin body). */
export async function apiNoContent(path: string, options: ApiFetchOptions = {}): Promise<void> {
  const response = await apiFetch(path, options);
  if (!response.ok) throw await toApiError(response);
}
