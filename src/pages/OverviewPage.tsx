import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useAdminQuery } from '../lib/useAdminQuery';
import { todayYmd, useStickyState } from '../lib/useStickyState';
import { CountUp } from '../components/CountUp';
import { BorderBeam } from '../components/fx/BorderBeam';
import { TextureButton } from '../components/fx/TextureButton';
import { StatusIndicator } from '../components/fx/StatusIndicator';
import { formatDuration, formatInr, formatNumber, formatTime, formatYmd } from '../lib/format';

const RideOutcomeChart = lazy(() => import('../components/RideOutcomeChart'));

type Overview = {
  signups: { riders: number; pilots: number };
  logins?: { riders: number; pilots: number };
  dau?: { riders: number; pilots: number };
  rides: { requested: number; completed: number; cancelled: number };
  gmvPaise: number;
  platformRevenuePaise: number;
  onlinePilotsNow: number;
  averagePickupEtaSec: number | null;
  screenTimeSec: number;
};

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">{title}</h2>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  big,
  count,
  beam,
}: {
  label: string;
  value: string | number;
  hint?: string;
  big?: boolean;
  count?: { n: number; fmt: (n: number) => string };
  beam?: boolean;
}) {
  return (
    <div className="surface relative overflow-hidden p-4">
      {beam ? <BorderBeam size={90} duration={9} colorFrom="#ffc400" colorTo="#ff2d95" /> : null}
      <div className="text-[13px] font-medium text-[var(--prila-muted)]">{label}</div>
      <div
        className={`mt-1.5 font-semibold tracking-tight text-[var(--prila-ink)] tabular-nums ${
          big ? 'text-4xl leading-10' : 'text-[26px] leading-8'
        }`}
      >
        {count ? <CountUp value={count.n} format={count.fmt} /> : value}
      </div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function OverviewPage() {
  const [from, setFrom] = useStickyState('overview_from', todayYmd());
  const [to, setTo] = useStickyState('overview_to', todayYmd());
  const { data, error, loading, reload } = useAdminQuery<Overview>(
    `/admin/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (data) setUpdatedAt(new Date());
  }, [data]);

  const rides = data?.rides;
  const open = rides ? Math.max(rides.requested - rides.completed - rides.cancelled, 0) : 0;
  const completedPct = rides ? pct(rides.completed, rides.requested) : 0;
  const cancelledPct = rides ? pct(rides.cancelled, rides.requested) : 0;
  const openPct = rides ? Math.max(Math.round((100 - completedPct - cancelledPct) * 10) / 10, 0) : 0;

  const breakdown: { label: string; n: number; dot: string }[] = rides
    ? [
        { label: 'Completed', n: rides.completed, dot: 'bg-emerald-500' },
        { label: 'Cancelled', n: rides.cancelled, dot: 'bg-rose-500' },
        { label: 'Open / other', n: open, dot: 'bg-slate-300' },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {from === to ? formatYmd(from) : `${formatYmd(from)} – ${formatYmd(to)}`}
            {updatedAt ? <span className="text-slate-400"> · Updated {formatTime(updatedAt)}</span> : null}
          </p>
        </div>
        <div className="surface flex flex-wrap items-end gap-2 p-2.5">
          <label className="text-xs font-medium text-slate-500">
            From
            <input
              type="date"
              name="from"
              className="field mt-1 block !py-1.5"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            To
            <input
              type="date"
              name="to"
              className="field mt-1 block !py-1.5"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <div className="w-24">
            <TextureButton type="button" onClick={reload}>
              Refresh
            </TextureButton>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="prila-skel h-24" />
          ))}
        </div>
      ) : null}

      {data && rides ? (
        <>
          <Section title="Money">
            <div className="grid gap-3 md:grid-cols-2">
              <Metric big beam label="Gross merchandise value" value={formatInr(data.gmvPaise)} count={{ n: data.gmvPaise, fmt: formatInr }} hint="Total fares booked" />
              <Metric
                big
                label="Platform revenue"
                value={formatInr(data.platformRevenuePaise)}
                count={{ n: data.platformRevenuePaise, fmt: formatInr }}
                hint={`${pct(data.platformRevenuePaise, data.gmvPaise)}% of GMV`}
              />
            </div>
          </Section>

          <Section title="Rides">
            <div className="surface p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[13px] font-medium text-[var(--prila-muted)]">Requested</div>
                  <div className="mt-1 text-4xl font-semibold leading-10 tracking-tight text-[var(--prila-ink)] tabular-nums">
                    {formatNumber(rides.requested)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium text-[var(--prila-muted)]">Completion rate</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{completedPct}%</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <Suspense fallback={<div className="prila-skel h-48 w-48 shrink-0" aria-busy="true" />}>
                  <RideOutcomeChart
                    centerLabel="Requested"
                    centerValue={formatNumber(rides.requested)}
                    slices={[
                      { label: 'Completed', n: rides.completed, color: '#10b981' },
                      { label: 'Cancelled', n: rides.cancelled, color: '#f43f5e' },
                      { label: 'Open / other', n: open, color: '#cbd5e1' },
                    ]}
                  />
                </Suspense>
                <div className="min-w-48 flex-1">
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${completedPct}% completed, ${cancelledPct}% cancelled, ${openPct}% open`}
              >
                <div className="bg-emerald-500" style={{ width: `${completedPct}%` }} />
                <div className="bg-rose-500" style={{ width: `${cancelledPct}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
                {breakdown.map((b) => (
                  <div key={b.label}>
                    <dt className="flex items-center gap-2 text-[13px] text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${b.dot}`} aria-hidden="true" />
                      {b.label}
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--prila-ink)]">
                      {formatNumber(b.n)}
                    </dd>
                  </div>
                ))}
              </dl>
                </div>
              </div>
            </div>
          </Section>

          <Section title="People">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Rider signups" value={formatNumber(data.signups.riders)} count={{ n: data.signups.riders, fmt: formatNumber }} />
              <Metric label="Pilot signups" value={formatNumber(data.signups.pilots)} count={{ n: data.signups.pilots, fmt: formatNumber }} />
              <div className="surface p-4">
                <div className="text-[13px] font-medium text-[var(--prila-muted)]">Online pilots now</div>
                <div className="mt-1.5 flex items-center gap-2.5 text-[26px] font-semibold leading-8 tracking-tight text-[var(--prila-ink)] tabular-nums">
                  <CountUp value={data.onlinePilotsNow} format={formatNumber} />
                  <StatusIndicator state={data.onlinePilotsNow > 0 ? 'active' : 'idle'} size="sm" />
                </div>
                <div className="mt-1 text-xs text-slate-400">Live</div>
              </div>
              <Metric
                label="Avg pickup ETA"
                value={data.averagePickupEtaSec == null ? '—' : formatDuration(data.averagePickupEtaSec)}
              />
            </div>
          </Section>

          <Section title="Engagement">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Rider app opens" value={formatNumber(data.logins?.riders ?? 0)} />
              <Metric label="Pilot app opens" value={formatNumber(data.logins?.pilots ?? 0)} />
              <Metric
                label="Daily active users"
                value={`${formatNumber(data.dau?.riders ?? 0)} / ${formatNumber(data.dau?.pilots ?? 0)}`}
                hint="Riders / pilots"
              />
              <Metric label="Screen time" value={formatDuration(data.screenTimeSec)} hint="From screen_time events" />
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}
