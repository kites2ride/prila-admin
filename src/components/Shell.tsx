import type { ReactNode } from 'react';
import { clearSession, getEmail } from '../lib/session';
import { navigate, type RouteId } from '../lib/pathRouter';
import { useKycPending } from '../lib/kycAlerts';

const NAV: { id: RouteId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'live-map', label: 'Live map' },
  { id: 'kyc', label: 'KYC review' },
  { id: 'app-config', label: 'App config' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'surge', label: 'Surge heatmap' },
  { id: 'maps', label: 'Maps (cost)' },
  { id: 'pilot-quality', label: 'Pilot quality' },
  { id: 'pilots', label: 'Pilots' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'home-promo', label: 'Home promo' },
  { id: 'push', label: 'Push' },
  { id: 'reports', label: 'Reports' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'nudges', label: 'Nudges' },
  { id: 'sos', label: 'SOS' },
  { id: 'support', label: 'Support' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'app-update', label: 'App update' },
  { id: 'cities', label: 'Cities' },
  { id: 'zones', label: 'Zones (map)' },
  { id: 'zone-rules', label: 'Zone rules' },
  { id: 'landmarks', label: 'Landmarks' },
  { id: 'services-fares', label: 'Services & fares' },
  { id: 'rides', label: 'Rides' },
  { id: 'audit', label: 'Audit log' },
];

type Props = {
  route: RouteId;
  children: ReactNode;
};

export function Shell({ route, children }: Props) {
  const kycPending = useKycPending();
  return (
    <div className="min-h-screen bg-[var(--prila-bg)] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--prila-border)] bg-[var(--prila-surface)] lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <img src="/brand/prila-wordmark-light.svg" alt="Prila" className="h-8 w-auto" />
          <div className="mt-1 text-xs text-[var(--prila-muted)]">Admin · Ops</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`rounded-xl px-3 py-2 text-left text-sm whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-violet-50 font-semibold text-[var(--prila-purple)]'
                    : 'text-slate-600 hover:bg-[var(--prila-bg)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  {item.label}
                  {item.id === 'kyc' && kycPending ? (
                    <span
                      className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-bold leading-5 text-white"
                      aria-label={`${kycPending} waiting for review`}
                    >
                      {kycPending > 99 ? '99+' : kycPending}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-100 px-5 py-4 lg:block">
          <div className="truncate text-xs text-slate-500">{getEmail()}</div>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-red-600"
            onClick={() => {
              clearSession();
              navigate('login');
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
