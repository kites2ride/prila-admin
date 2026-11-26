import type { ReactNode } from 'react';
import { AnimatedGridPattern } from './fx/AnimatedGridPattern';

type Tone = 'neutral' | 'success' | 'danger' | 'warn' | 'info' | 'accent';

const TONE: Record<Tone, string> = {
  neutral: '',
  success: 'badge-success',
  danger: 'badge-danger',
  warn: 'badge-warn',
  info: 'badge-info',
  accent: 'badge-accent',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${TONE[tone]}`}>{children}</span>;
}

/** Empty states teach the next step instead of saying "nothing here". */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-[var(--prila-border)] bg-white px-6 py-12 text-center">
      <AnimatedGridPattern
        numSquares={8}
        maxOpacity={0.08}
        duration={6}
        className="!fill-slate-500/20 !stroke-slate-400/15 [mask-image:radial-gradient(260px_circle_at_center,white,transparent)]"
      />
      <p className="relative text-sm font-semibold text-[var(--prila-ink)]">{title}</p>
      {hint ? <p className="relative max-w-sm text-[13px] text-slate-500">{hint}</p> : null}
      {action ? <div className="relative mt-3">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** Plain-English names for the backend's ride states. The raw code is what the API receives; this is what people read. */
const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  searching: 'Searching for a pilot',
  pilot_assigned: 'Pilot assigned',
  pilot_arriving: 'Pilot on the way',
  pilot_arrived: 'Pilot arrived',
  in_progress: 'Trip in progress',
  completed: 'Completed',
  paid: 'Paid',
  ack: 'Acknowledged',
  no_pilot_found: 'No pilot found',
  cancelled_by_rider: 'Cancelled by rider',
  cancelled_by_pilot: 'Cancelled by pilot',
  cancelled_by_system: 'Cancelled by system',
};

/** "pilot_arriving" becomes "Pilot on the way"; unknown codes fall back to sentence case ("some_new_state" to "Some new state"). */
export function statusLabel(raw?: string | null): string {
  if (!raw) return '—';
  const known = STATUS_LABEL[raw];
  if (known) return known;
  const words = raw.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusTone(status?: string | null): Tone {
  const s = (status ?? '').toLowerCase();
  if (/(complete|approved|active|verified|paid|resolved|done|success|online)/.test(s)) return 'success';
  if (/(cancel|fail|reject|expire|suspend|block|refus|declin|no_pilot)/.test(s)) return 'danger';
  if (/(search|request|pending|open|review|submitted|await|issue)/.test(s)) return 'warn';
  if (/(progress|arriv|accept|assign|transit|ongoing|started)/.test(s)) return 'info';
  return 'neutral';
}

/** One colour logic for every status in every table. */
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--prila-purple-soft)] text-xs font-semibold text-[var(--prila-purple)]"
    >
      {initials || '?'}
    </span>
  );
}
