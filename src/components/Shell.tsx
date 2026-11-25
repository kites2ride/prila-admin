import type { ReactNode } from 'react';
import { navigate, type RouteId } from '../lib/pathRouter';
import { ProfileMenu } from './ProfileMenu';
import { useKycPending } from '../lib/kycAlerts';
import { NAV_GROUPS, iconFor } from '../lib/nav';
import { CommandPalette } from './CommandPalette';
import { Toaster } from './Toaster';

type Props = {
  route: RouteId;
  children: ReactNode;
};

export function Shell({ route, children }: Props) {
  const kycPending = useKycPending();
  return (
    <div className="min-h-screen bg-[var(--prila-bg)] lg:grid lg:grid-cols-[248px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--prila-ink)] focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <aside className="border-b border-[var(--prila-border)] bg-[var(--prila-surface)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-4 lg:py-5">
          <img src="/brand/prila-wordmark-light.svg" alt="Prila" className="logo-on-light h-7 w-auto" />
          <img src="/brand/prila-wordmark-dark.svg" alt="Prila" className="logo-on-dark h-7 w-auto" />
          <span className="rounded-md bg-[var(--prila-purple-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--prila-purple)]">
            Ops
          </span>
        </div>
        <div className="hidden px-3 pb-3 lg:block">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('prila:palette'))}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--prila-border)] bg-[var(--prila-surface-2)] px-3 py-1.5 text-[13px] text-slate-500 hover:border-slate-300"
          >
            Jump to…
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              Ctrl K
            </kbd>
          </button>
        </div>
        <nav
          aria-label="Main"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-4"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex gap-1 lg:mb-4 lg:block lg:space-y-0.5">
              <div className="hidden px-3 pb-1 text-xs font-medium text-slate-400 lg:block">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = route === item.id;
                const Icon = iconFor(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                    className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap ${
                      active
                        ? 'bg-[var(--prila-purple-soft)] font-semibold text-[var(--prila-purple)]'
                        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        size={16}
                        strokeWidth={1.85}
                        aria-hidden={true}
                        className={active ? 'text-[var(--prila-purple)]' : 'text-slate-500'}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.id === 'kyc' && kycPending ? (
                        <span
                          className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] font-semibold leading-5 text-white"
                          aria-label={`${kycPending} waiting for review`}
                        >
                          {kycPending > 99 ? '99+' : kycPending}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mono hidden border-t border-[var(--prila-border-soft)] px-5 py-3 text-[11px] text-slate-400 lg:block">
          Prila Admin v{__APP_VERSION__}
        </div>
      </aside>
      <CommandPalette />
      <Toaster />
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end border-b border-[var(--prila-border)] bg-[var(--prila-bg)]/90 px-4 backdrop-blur md:px-8">
          <ProfileMenu />
        </header>
        <main id="main" className="min-w-0 p-4 md:p-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
