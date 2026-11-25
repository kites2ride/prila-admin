const TOKEN_KEY = 'prila_admin_token';
const EMAIL_KEY = 'prila_admin_email';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getEmail(): string | null {
  return sessionStorage.getItem(EMAIL_KEY);
}

/** "ops.lead@prila.in" becomes "Ops Lead". The API only returns an email, so the name is derived from it. */
export function displayNameFromEmail(email: string | null): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return 'Admin';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function setSession(token: string, email: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EMAIL_KEY, email);
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
}
