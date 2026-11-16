import { useEffect, useState } from 'react';
import { adminFetch } from './adminFetch';
import { navigate } from './pathRouter';

/**
 * Pending-KYC badge for the admin menu + optional desktop pop-up.
 * Polls GET /admin/kyc/count every 30 s on every page (paused while the tab is hidden).
 * A pop-up is shown only when a NEW submission arrives after the page loaded, and only
 * if the admin allowed browser notifications.
 */
const POLL_MS = 30_000;
export const KYC_CHANGED_EVENT = 'prila:kyc-changed';

type Count = {
  pending: number;
  newest: { id: string; name: string | null; vehicleType: string | null; submittedAt: string | null } | null;
};

export function desktopAlertsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function desktopAlertsState(): NotificationPermission | 'unsupported' {
  return desktopAlertsSupported() ? Notification.permission : 'unsupported';
}

/** Must be called from a click (browsers block permission prompts otherwise). */
export async function enableDesktopAlerts(): Promise<NotificationPermission | 'unsupported'> {
  if (!desktopAlertsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function popUp(c: Count) {
  if (desktopAlertsState() !== 'granted' || !c.newest) return;
  try {
    const who = c.newest.name ?? 'A pilot';
    const vehicle = c.newest.vehicleType ? ` (${c.newest.vehicleType})` : '';
    const n = new Notification('New KYC to review', {
      body: `${who}${vehicle} sent documents. ${c.pending} waiting.`,
      tag: 'prila-kyc', // replaces the previous pop-up instead of stacking
      icon: '/brand/prila-app-icon.svg',
    });
    n.onclick = () => {
      window.focus();
      navigate('kyc');
      n.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker — badge still works */
  }
}

export function useKycPending(): number | null {
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let lastNewestId: string | null | undefined; // undefined = first load (no pop-up)
    const tick = async () => {
      if (document.hidden) return;
      try {
        const c = await adminFetch<Count>('/admin/kyc/count');
        if (stopped) return;
        setPending(c.pending);
        const newestId = c.newest?.id ?? null;
        if (lastNewestId !== undefined && newestId && newestId !== lastNewestId) popUp(c);
        lastNewestId = newestId;
      } catch {
        /* keep the last value; the KYC page shows errors */
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), POLL_MS);
    const onVisible = () => !document.hidden && void tick();
    const onChanged = () => void tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(KYC_CHANGED_EVENT, onChanged);
    return () => {
      stopped = true;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(KYC_CHANGED_EVENT, onChanged);
    };
  }, []);

  return pending;
}
