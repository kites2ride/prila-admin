import { useState, type FormEvent } from 'react';
import { adminFetch } from '../lib/adminFetch';
import { setSession } from '../lib/session';
import { navigate } from '../lib/pathRouter';

export function LoginPage() {
  const [email, setEmail] = useState('ops@prila.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<{ accessToken: string; email: string }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(data.accessToken, data.email);
      navigate('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-[var(--prila-border)] bg-white px-3.5 py-2.5 text-sm hover:border-slate-300';

  return (
    <div className="grid min-h-screen bg-[var(--prila-bg)] lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between login-brand p-12 lg:flex">
        <img src="/brand/prila-wordmark-dark.svg" alt="Prila" className="h-8 w-auto self-start" />
        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Every ride, every pilot, one calm control room.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Dispatch, KYC, fares and payouts for Prila operations.
          </p>
        </div>
        <p className="text-xs text-slate-500">Prila Admin · Restricted access</p>
      </aside>
      <div className="flex items-center justify-center p-4 sm:p-8">
        <form onSubmit={onSubmit} className="prila-rise w-full max-w-sm">
          <img src="/brand/prila-app-icon.svg" alt="" className="h-11 w-11 lg:hidden" />
          <h1 className="mt-4 text-2xl font-semibold text-[var(--prila-ink)] lg:mt-0">Welcome back</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Sign in to the Prila admin panel.</p>
          <label className="mt-8 block text-sm font-medium text-slate-700">
            Email
            <input
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              name="email"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Password
            <input
              className={field}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <p className="mt-3 min-h-5 text-sm text-red-600" role="alert" aria-live="polite">
            {error}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[var(--prila-ink)] py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
