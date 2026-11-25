import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { formatDateTime } from '../lib/format';

type Nudge = {
  id: string;
  code: string;
  title: string;
  body: string;
  audience: string;
  trigger: string;
  enabled: boolean;
  lastRunAt?: string;
};

type List = { items: Nudge[] };

export function NudgesPage() {
  const { data, error, loading, reload } = useAdminQuery<List>('/admin/nudges');

  async function toggle(id: string, enabled: boolean) {
    await adminFetch(`/admin/nudges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
    reload();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Nudges</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Cron every 15 min when enabled</p>
      </div>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <div className="prila-skel h-24 w-full" /> : null}
      <div className="grid gap-3">
        {(data?.items ?? []).map((n) => (
          <div key={n.id} className="surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{n.title}</div>
                <div className="text-xs text-[var(--prila-muted)]">
                  {n.code} · {n.trigger} · {n.audience}
                </div>
                <p className="mt-2 text-sm">{n.body}</p>
                {n.lastRunAt ? (
                  <div className="mt-1 text-xs text-[var(--prila-muted)]">
                    Last run {formatDateTime(n.lastRunAt)}
                  </div>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={n.enabled} onChange={(e) => void toggle(n.id, e.target.checked)} />
                Enabled
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
