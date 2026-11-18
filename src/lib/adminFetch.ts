import { clearSession, getToken } from './session';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export class AdminApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Backend validation errors arrive as details: [{ path, message }]. Turn them into readable text. */
function withDetails(message: string, details: unknown): string {
  if (!Array.isArray(details)) return message;
  const parts = details
    .map((d) => {
      const x = d as { path?: unknown; message?: unknown };
      if (typeof x?.message !== 'string') return null;
      return typeof x.path === 'string' && x.path ? `${x.path}: ${x.message}` : x.message;
    })
    .filter((v): v is string => v !== null)
    .slice(0, 5);
  return parts.length ? `${message} — ${parts.join('; ')}` : message;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
    throw new AdminApiError('UNAUTHORIZED', 'Session expired', 401);
  }

  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new AdminApiError('BAD_RESPONSE', `Server returned an unexpected response (HTTP ${res.status})`, res.status);
  }
  if (!json.ok) {
    throw new AdminApiError(
      json.error.code,
      withDetails(json.error.message, json.error.details),
      res.status,
      json.error.details,
    );
  }
  return json.data;
}
