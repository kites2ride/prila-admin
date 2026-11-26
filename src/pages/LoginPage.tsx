import { useState, type FormEvent } from 'react';
import { adminFetch } from '../lib/adminFetch';
import { setSession } from '../lib/session';
import { navigate } from '../lib/pathRouter';
import { AnimatedGridPattern } from '../components/fx/AnimatedGridPattern';
import { BorderBeam } from '../components/fx/BorderBeam';
import BlurText from '../components/fx/BlurText';
import ShinyText from '../components/fx/ShinyText';
import ParticleButton, { type ParticleButtonStatus } from '../components/fx/ParticleButton';

export function LoginPage() {
  const [email, setEmail] = useState('ops@prila.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ParticleButtonStatus>('idle');
  const busy = status === 'pending' || status === 'success';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setStatus('pending');
    setError(null);
    try {
      const data = await adminFetch<{ accessToken: string; email: string }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(data.accessToken, data.email);
      setStatus('success');
      // Let the success burst play before the shell takes over.
      window.setTimeout(() => navigate('overview'), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setStatus('error');
      window.setTimeout(() => setStatus('idle'), 1800);
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-[var(--prila-border)] bg-white px-3.5 py-2.5 text-sm hover:border-slate-300';

  return (
    <div className="grid min-h-screen bg-[var(--prila-bg)] lg:grid-cols-[1.05fr_1fr]">
      <aside className="login-brand relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <AnimatedGridPattern
          numSquares={22}
          maxOpacity={0.14}
          duration={5}
          className="!fill-white/10 !stroke-white/10 [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]"
        />
        <img src="/brand/prila-wordmark-dark.svg" alt="Prila" className="relative h-8 w-auto self-start" />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            <BlurText text="Every ride, every pilot, one calm control room." delay={70} animateBy="words" trigger="load" />
          </h2>
          <p className="mt-4 text-base leading-relaxed">
            <ShinyText text="Dispatch, KYC, fares and payouts for Prila operations." color="#94a3b8" shineColor="#ffffff" speed={3} />
          </p>
        </div>
        <p className="relative text-xs text-slate-500">Prila Admin · Restricted access</p>
      </aside>
      <div className="flex items-center justify-center p-4 sm:p-8">
        <form onSubmit={onSubmit} className="prila-rise surface relative w-full max-w-sm overflow-hidden p-7">
          <BorderBeam size={120} duration={8} colorFrom="#ff2d95" colorTo="#6d28d9" />
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
          <ParticleButton
            type="submit"
            status={status}
            disabled={busy}
            pendingLabel="Signing in"
            successLabel="Welcome"
            errorLabel="Try again"
            className="mt-2 w-full"
          >
            Sign in
          </ParticleButton>
        </form>
      </div>
    </div>
  );
}
