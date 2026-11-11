import { StatCard } from '../components/StatCard';
import { useAdminQuery } from '../lib/useAdminQuery';
import { todayYmd, useStickyState } from '../lib/useStickyState';

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

function paiseToInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function OverviewPage() {
  const [from, setFrom] = useStickyState('overview_from', todayYmd());
  const [to, setTo] = useStickyState('overview_to', todayYmd());
  const { data, error, loading, reload } = useAdminQuery<Overview>(
    `/admin/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-slate-500">IST day bounds · sticky date filters</p>
        </div>
        <div className="sticky top-0 z-10 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <label className="text-xs font-medium text-slate-500">
            From
            <input
              type="date"
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            To
            <input
              type="date"
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={reload}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {loading && !data ? <div className="text-sm text-slate-500">Loading KPIs…</div> : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Rider signups" value={data.signups.riders} />
          <StatCard label="Pilot signups" value={data.signups.pilots} />
          <StatCard label="Rides requested" value={data.rides.requested} />
          <StatCard label="Rides completed" value={data.rides.completed} />
          <StatCard label="Rides cancelled" value={data.rides.cancelled} />
          <StatCard label="GMV" value={paiseToInr(data.gmvPaise)} hint="paise → INR" />
          <StatCard label="Platform revenue" value={paiseToInr(data.platformRevenuePaise)} />
          <StatCard label="Online pilots now" value={data.onlinePilotsNow} />
          <StatCard
            label="Avg pickup ETA"
            value={data.averagePickupEtaSec == null ? '—' : `${Math.round(data.averagePickupEtaSec)}s`}
          />
          <StatCard label="App opens / logins" value={data.logins?.riders ?? 0} hint="analytics events" />
          <StatCard
            label="DAU"
            value={`${data.dau?.riders ?? 0} / ${data.dau?.pilots ?? 0}`}
            hint="riders / pilots"
          />
          <StatCard label="Screen time" value={`${data.screenTimeSec}s`} hint="from screen_time events" />
        </div>
      ) : null}
    </div>
  );
}
