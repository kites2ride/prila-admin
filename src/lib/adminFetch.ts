import { clearSession, getToken } from './session';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export class AdminApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
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

  const json = (await res.json()) as ApiEnvelope<T>;
  if (!json.ok) {
    throw new AdminApiError(json.error.code, json.error.message, res.status);
  }
  return json.data;
}
