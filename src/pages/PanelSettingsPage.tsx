import { useState, type ReactNode } from 'react';
import { BellRing, KeyRound, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { Toggle } from '../components/formKit';
import { Badge } from '../components/ui';
import { sendTestAlert, turnOffAlerts, turnOnAlerts, useAlertStatus } from '../lib/kycAlerts';
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme';
import { toast } from '../lib/toast';

const SESSION_KEYS = ['prila_admin_token', 'prila_admin_email'];

const THEMES: { id: ThemePref; label: string; hint: string; Icon: LucideIcon }[] = [
  { id: 'light', label: 'Light', hint: 'Bright, high contrast', Icon: Sun },
  { id: 'dark', label: 'Dark', hint: 'Easier on the eyes at night', Icon: Moon },
  { id: 'system', label: 'System', hint: 'Match this device', Icon: Monitor },
];

function SettingsCard({
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--prila-purple-soft)] text-[var(--prila-purple)]"
            >
              <Icon size={16} strokeWidth={1.85} />
            </span>
          ) : null}
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">{title}</h2>
            {description ? <p className="mt-0.5 max-w-xl text-[13px] text-slate-500">{description}</p> : null}
          </div>
        </div>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Appearance() {
  const pref = useThemePref();
  return (
    <SettingsCard
      icon={Moon}
      title="Appearance"
      description="Choose how the admin panel looks. Your choice is remembered on this device."
    >
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
        {THEMES.map(({ id, label, hint, Icon }) => {
          const active = pref === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemePref(id)}
              className={`flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left ${
                active
                  ? 'border-[var(--prila-purple)] bg-[var(--prila-purple-soft)] shadow-[0_0_0_1px_var(--prila-purple)]'
                  : 'border-[var(--prila-border)] hover:border-slate-300'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={1.85}
                aria-hidden={true}
                className={active ? 'text-[var(--prila-purple)]' : 'text-slate-500'}
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--prila-ink)]">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

function Notifications() {
  const status = useAlertStatus();
  const [busy, setBusy] = useState(false);

  async function onToggle(next: boolean) {
    if (!next) {
      turnOffAlerts();
      toast('KYC alerts turned off on this device.', 'info');
      return;
    }
    setBusy(true);
    const result = await turnOnAlerts();
    setBusy(false);
    if (result === 'on') toast('KYC alerts are on. You will be told when a pilot sends documents.');
    else if (result === 'blocked') toast('The browser blocked notifications. Allow them in site settings first.', 'danger');
  }

  async function test() {
    const ok = await sendTestAlert();
    if (!ok) toast('Could not show a system notification on this device.', 'danger');
  }

  return (
    <SettingsCard
      icon={BellRing}
      title="KYC approval alerts"
      description="Get a notification on this laptop or phone the moment a pilot sends KYC documents for your approval."
      badge={status === 'on' ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}
    >
      {status === 'unsupported' ? (
        <p className="alert alert-warn">
          This browser cannot show notifications. On iPhone, open the panel in Safari, choose Share, then Add to Home
          Screen, and turn alerts on from the installed app.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[var(--prila-ink)]">Notify me about new KYC submissions</div>
              <div className="text-xs text-slate-500">
                Also adds a count to the tab title, for example “(2) KYC review”.
              </div>
            </div>
            <Toggle
              checked={status === 'on'}
              onChange={(v) => void onToggle(v)}
              label="Notify me about new KYC submissions"
              disabled={busy || status === 'blocked'}
            />
          </div>

          {status === 'blocked' ? (
            <p className="alert alert-danger mt-4">
              Notifications are blocked for this site. Click the lock icon next to the address bar, set Notifications to
              Allow, then come back and turn this on.
            </p>
          ) : null}

          {status === 'on' ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void test()}>
                Send a test alert
              </button>
              <span className="text-xs text-slate-500">Check that it appears on your device.</span>
            </div>
          ) : null}

          <ul className="mt-5 space-y-1.5 border-t border-[var(--prila-border-soft)] pt-4 text-[13px] text-slate-500">
            <li>Works while the panel is open in any tab or window, even behind other windows.</li>
            <li>Each device is set up separately: turn it on once on your laptop and once on your phone.</li>
            <li>
              Alerts with the browser fully closed are not available yet. They need push notifications set up on the
              server.
            </li>
          </ul>
        </>
      )}
    </SettingsCard>
  );
}

function Security() {
  return (
    <SettingsCard
      icon={KeyRound}
      title="Password"
      description="Change the password you use to sign in to the admin panel."
      badge={<Badge tone="info">Coming soon</Badge>}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-secondary" disabled aria-describedby="pw-note">
          Reset password
        </button>
        <p id="pw-note" className="text-xs text-slate-500">
          Password reset is not available yet. Until then, ask a platform admin to reset it for you.
        </p>
      </div>
    </SettingsCard>
  );
}

export function PanelSettingsPage() {
  function resetFilters() {
    const keep = new Set(SESSION_KEYS);
    Object.keys(sessionStorage)
      .filter((k) => !keep.has(k))
      .forEach((k) => sessionStorage.removeItem(k));
    toast('Saved filters and page positions were cleared.');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Preferences for this admin panel. App, fare and dispatch settings live under Configuration in the sidebar.
        </p>
      </div>

      <Appearance />
      <Notifications />
      <Security />

      <SettingsCard
        title="Saved filters"
        description="Date ranges, status filters and page numbers are remembered while this tab is open. Clear them to start every list from scratch."
      >
        <button type="button" className="btn btn-secondary" onClick={resetFilters}>
          Clear saved filters
        </button>
      </SettingsCard>

      <SettingsCard title="About">
        <dl className="text-sm">
          <div className="flex justify-between gap-2 py-1.5">
            <dt className="text-slate-500">Admin panel version</dt>
            <dd className="mono text-[var(--prila-ink)]">v{__APP_VERSION__}</dd>
          </div>
          <div className="flex justify-between gap-2 py-1.5">
            <dt className="text-slate-500">Timezone for dates</dt>
            <dd className="text-[var(--prila-ink)]">IST (Asia/Kolkata)</dd>
          </div>
        </dl>
      </SettingsCard>
    </div>
  );
}
