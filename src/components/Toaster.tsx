import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { dismissToast, toast, useToasts } from '../lib/toast';

const ICON = { success: CheckCircle2, danger: XCircle, info: Info } as const;
const COLOR = { success: 'text-emerald-600', danger: 'text-rose-600', info: 'text-sky-600' } as const;

/** Bottom-right stack. Announced politely to screen readers, auto-dismisses. */
export function Toaster() {
  const items = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className="prila-toast pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--prila-border)] bg-white p-3.5 shadow-[var(--prila-shadow-pop)]"
          >
            <Icon size={18} strokeWidth={2} aria-hidden={true} className={`mt-0.5 shrink-0 ${COLOR[t.tone]}`} />
            <p className="min-w-0 flex-1 break-words text-sm font-medium text-[var(--prila-ink)]">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(t.id)}
              className="-m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} aria-hidden={true} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Drop-in for the old inline success banner: shows `msg` as a toast whenever it changes. */
export function MsgToast({ msg }: { msg: string | null | undefined }) {
  useEffect(() => {
    if (msg) toast(msg, 'success');
  }, [msg]);
  return null;
}
