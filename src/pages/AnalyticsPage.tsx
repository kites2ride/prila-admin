import { ListPage } from '../components/ListPage';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';
import { formatDateTime } from '../lib/format';

type Row = {
  id: string;
  name: string;
  app: string;
  userId?: string | null;
  platform?: string;
  at?: string;
};

type List = { items: Row[]; page: number; limit: number; total: number };
type PermStats = {
  riders: { total: number; locAlways?: number; locWhile?: number; locDenied?: number; notifGranted?: number; notifDenied?: number };
  pilots: { total: number; locAlways?: number; locWhile?: number; locDenied?: number; notifGranted?: number; notifDenied?: number };
};

export function AnalyticsPage() {
  const [page, setPage] = useStickyState('analytics_page', 1);
  const limit = 30;
  const { data, error, loading } = useAdminQuery<List>(`/admin/analytics/events?page=${page}&limit=${limit}`);
  const perms = useAdminQuery<PermStats>('/admin/permissions/stats');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Events + permission coverage</p>
      </div>

      {perms.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="surface p-4">
            <div className="font-semibold">Rider permissions</div>
            <div className="mt-2 text-sm text-[var(--prila-muted)]">Total {perms.data.riders.total}</div>
            <div className="mt-1 text-sm">
              Loc always {perms.data.riders.locAlways ?? 0} · while {perms.data.riders.locWhile ?? 0} · denied{' '}
              {perms.data.riders.locDenied ?? 0}
            </div>
            <div className="mt-1 text-sm">
              Notif granted {perms.data.riders.notifGranted ?? 0} · denied {perms.data.riders.notifDenied ?? 0}
            </div>
          </div>
          <div className="surface p-4">
            <div className="font-semibold">Pilot permissions</div>
            <div className="mt-2 text-sm text-[var(--prila-muted)]">Total {perms.data.pilots.total}</div>
            <div className="mt-1 text-sm">
              Loc always {perms.data.pilots.locAlways ?? 0} · while {perms.data.pilots.locWhile ?? 0} · denied{' '}
              {perms.data.pilots.locDenied ?? 0}
            </div>
            <div className="mt-1 text-sm">
              Notif granted {perms.data.pilots.notifGranted ?? 0} · denied {perms.data.pilots.notifDenied ?? 0}
            </div>
          </div>
        </div>
      ) : null}

      <ListPage
        title="Recent events"
        page={page}
        limit={limit}
        total={data?.total ?? 0}
        onPage={setPage}
        loading={loading}
        error={error}
      >
        <div className="surface overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--prila-bg)] text-xs text-[var(--prila-muted)]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Platform</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((row) => (
                <tr key={row.id} className="border-t border-[var(--prila-border)]">
                  <td className="px-4 py-3 text-[var(--prila-muted)] whitespace-nowrap">
                    {row.at ? formatDateTime(row.at) : '—'}
                  </td>
                  <td className="px-4 py-3">{row.app}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.platform ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPage>
    </div>
  );
}
