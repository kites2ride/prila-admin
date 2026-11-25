import { LogOut } from 'lucide-react';
import { clearSession, displayNameFromEmail, getEmail } from '../lib/session';
import { navigate } from '../lib/pathRouter';

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--prila-border-soft)] py-3 first:border-t-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`text-sm font-medium text-[var(--prila-ink)] ${mono ? 'mono' : ''}`} translate="no">
        {value}
      </dd>
    </div>
  );
}

export function ProfilePage() {
  const email = getEmail();
  const name = displayNameFromEmail(email);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your account on the Prila admin panel.</p>
      </div>

      <section className="surface p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--prila-ink)] text-xl font-semibold text-white"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-[var(--prila-ink)]" translate="no">
              {name}
            </div>
            <div className="truncate text-sm text-slate-500" translate="no">
              {email}
            </div>
          </div>
        </div>
        <dl className="mt-5">
          <Row label="Email" value={email ?? '—'} />
          <Row label="Display name" value={name} />
          <Row label="Access" value="Admin panel" />
          <Row label="Session" value="Active in this browser tab" />
        </dl>
        <p className="mt-3 text-xs text-slate-400">
          Your name is taken from your email address. Sign-in is per browser tab, so closing the tab ends the session.
        </p>
      </section>

      <section className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">Sign out</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">End your session on this device.</p>
        </div>
        <button
          type="button"
          className="btn btn-danger-soft"
          onClick={() => {
            clearSession();
            navigate('login');
          }}
        >
          <LogOut size={16} aria-hidden={true} />
          Log out
        </button>
      </section>
    </div>
  );
}
