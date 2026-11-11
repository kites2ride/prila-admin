import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';

type Row = {
  id: string;
  reporterId: string;
  reporterTyp: string;
  category: string;
  message: string;
  status: string;
  createdAt?: string;
};

type List = { items: Row[]; page: number; limit: number; total: number };

export function ReportsPage() {
  const [page, setPage] = useStickyState('reports_page', 1);
  const [status, setStatus] = useStickyState('reports_status', 'open');
  const limit = 20;
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const { data, error, loading, reload } = useAdminQuery<List>(`/admin/reports?${qs}`);
  const [busy, setBusy] = useState(false);

  async function resolve(id: string, next: 'resolved' | 'dismissed') {
    setBusy(true);
    try {
      await adminFetch(`/admin/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status: next }),
      });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ListPage
      title="Reports inbox"
      description="Safety and support reports from riders and pilots"
      page={page}
      limit={limit}
      total={data?.total ?? 0}
      onPage={setPage}
      loading={loading}
      error={error}
      filters={
        <select
          className="rounded-xl border border-[var(--prila-border)] px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {['open', 'resolved', 'dismissed'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--prila-border)] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--prila-bg)] text-xs uppercase text-[var(--prila-muted)]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-t border-[var(--prila-border)]">
                <td className="px-4 py-3 text-[var(--prila-muted)]">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {row.reporterTyp}
                  <div className="break-all text-[var(--prila-muted)]">{row.reporterId}</div>
                </td>
                <td className="px-4 py-3">{row.category}</td>
                <td className="px-4 py-3 max-w-xs">{row.message}</td>
                <td className="px-4 py-3 space-x-2">
                  {row.status === 'open' ? (
                    <>
                      <button type="button" className="text-[var(--prila-purple)]" disabled={busy} onClick={() => void resolve(row.id, 'resolved')}>
                        Resolve
                      </button>
                      <button type="button" className="text-slate-500" disabled={busy} onClick={() => void resolve(row.id, 'dismissed')}>
                        Dismiss
                      </button>
                    </>
                  ) : (
                    row.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListPage>
  );
}
