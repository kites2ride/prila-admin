import { useEffect, useState, useSyncExternalStore } from 'react';
import { adminFetch } from './adminFetch';
import { navigate } from './pathRouter';
import { setTitleBadge } from './title';
import { toast } from './toast';

/**
 * New-KYC alerts.
 *
 * While the admin panel is open in any tab or window (even behind other windows), it checks
 * GET /admin/kyc/count every 30 s. When a pilot submits documents, the admin gets:
 *   1. an in-app toast,
 *   2. a system notification (laptop or phone) if they turned alerts on and allowed the browser prompt,
 *   3. a count badge on the KYC menu item and in the tab title.
 *
 * Limit: this works while the panel is open. Alerts with the browser fully closed need Web Push,
 * which also needs a backend push endpoint.
 */
const POLL_MS = 30_000;
const PREF_KEY = 'prila_kyc_alerts';
export const KYC_CHANGED_EVENT = 'prila:kyc-changed';
const ALERTS_EVENT = 'prila:alerts-changed';

export type AlertStatus =
  | 'unsupported' // browser has no Notification API (e.g. iPhone Safari outside an installed web app)
  | 'blocked' // the user blocked notifications in browser settings
  | 'off' // not turned on yet, or turned off by the admin
  | 'on';

type Count = {
  pending: number;
  newest: { id: string; name: string | null; vehicleType: string | null; submittedAt: string | null } | null;
};

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function wantsAlerts(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

export function alertStatus(): AlertStatus {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && wantsAlerts() ? 'on' : 'off';
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
  window.dispatchEvent(new Event(ALERTS_EVENT));
}

/** React hook so the Settings page and the KYC page always agree. */
export function useAlertStatus(): AlertStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    alertStatus,
    () => 'off' as AlertStatus,
  );
}

/** Registers the worker that lets phones (and Chrome on desktop) show notifications. Safe to call repeatedly. */
export async function registerAlertWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* unsupported over plain http or in private mode; falls back to in-page notifications */
  }
}

/** Must run from a click, because browsers block permission prompts otherwise. */
export async function turnOnAlerts(): Promise<AlertStatus> {
  if (!supported()) return 'unsupported';
  try {
    if (Notification.permission === 'default') await Notification.requestPermission();
  } catch {
    /* fall through to the permission check below */
  }
  if (Notification.permission === 'granted') {
    try {
      localStorage.setItem(PREF_KEY, 'on');
    } catch {
      /* private mode: alerts still work for this session */
    }
    void registerAlertWorker();
  }
  emit();
  return alertStatus();
}

export function turnOffAlerts() {
  try {
    localStorage.setItem(PREF_KEY, 'off');
  } catch {
    /* ignore */
  }
  emit();
}

type ShowOptions = NotificationOptions & { renotify?: boolean; data?: unknown };

async function showSystemNotification(title: string, options: ShowOptions): Promise<boolean> {
  if (!supported() || Notification.permission !== 'granted') return false;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* try the in-page API next */
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      navigate('kyc');
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

const ICON = '/apple-touch-icon.png';
const BADGE = '/favicon-32.png';

export async function sendTestAlert(): Promise<boolean> {
  return showSystemNotification('Prila alerts are on', {
    body: 'You will see a message like this when a pilot sends KYC documents for approval.',
    tag: 'prila-test',
    icon: ICON,
    badge: BADGE,
    data: { url: '/#/settings' },
  });
}

function announce(c: Count) {
  const who = c.newest?.name ?? 'A pilot';
  const vehicle = c.newest?.vehicleType ? ` (${c.newest.vehicleType})` : '';
  const body = `${who}${vehicle} sent documents for approval. ${c.pending} waiting.`;
  toast(`New KYC to review: ${who}${vehicle}`, 'info');
  if (alertStatus() === 'on') {
    void showSystemNotification('New KYC to review', {
      body,
      tag: 'prila-kyc', // replaces the previous alert instead of stacking
      renotify: true,
      icon: ICON,
      badge: BADGE,
      requireInteraction: false,
      data: { url: '/#/kyc' },
    });
  }
}

export function useKycPending(): number | null {
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    let lastSubmittedAt: number | undefined; // undefined = first load, never alert for what was already waiting
    if (alertStatus() === 'on') void registerAlertWorker();

    const tick = async () => {
      // A hidden tab only keeps checking when the admin turned alerts on (that is the whole point of them).
      if (document.hidden && alertStatus() !== 'on') return;
      try {
        const c = await adminFetch<Count>('/admin/kyc/count');
        if (stopped) return;
        setPending(c.pending);
        setTitleBadge(c.pending);
        const at = c.newest?.submittedAt ? new Date(c.newest.submittedAt).getTime() : NaN;
        if (!Number.isNaN(at)) {
          // Only a later submission than anything seen before is "new". Approving the newest one
          // makes an older pilot the newest, and that must not alert.
          if (lastSubmittedAt !== undefined && at > lastSubmittedAt) announce(c);
          if (lastSubmittedAt === undefined || at > lastSubmittedAt) lastSubmittedAt = at;
        } else if (lastSubmittedAt === undefined) {
          lastSubmittedAt = 0;
        }
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
      setTitleBadge(0);
    };
  }, []);

  return pending;
}
