import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';

type Row = {
  id: string;
  riderId: string;
  rideId?: string | null;
  lat?: number;
  lng?: number;
  note?: string;
  status: string;
  createdAt?: string;
};

type List = { items: Row[]; page: number; limit: number; total: number };

export function SosPage() {
  const [page, setPage] = useStickyState('sos_page', 1);
  const [status, setStatus] = useStickyState('sos_status', 'open');
  const [busy, setBusy] = useState(false);
  const limit = 20;
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const { data, error, loading, reload } = useAdminQuery<List>(`/admin/sos?${qs}`);

  async function ack(id: string) {
    setBusy(true);
    try {
      await adminFetch(`/admin/sos/${id}/ack`, { method: 'POST' });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ListPage
      title="SOS alerts"
      description="Live rider emergency alerts"
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
          {['open', 'ack', 'closed'].map((s) => (
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
              <th className="px-4 py-3">Rider</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-t border-[var(--prila-border)]">
                <td className="px-4 py-3 text-[var(--prila-muted)]">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 break-all text-xs">{row.riderId}</td>
                <td className="px-4 py-3">
                  {row.lat != null && row.lng != null ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : '—'}
                </td>
                <td className="px-4 py-3">{row.note ?? '—'}</td>
                <td className="px-4 py-3">
                  {row.status === 'open' ? (
                    <button type="button" className="text-red-600 font-medium" disabled={busy} onClick={() => void ack(row.id)}>
                      Ack
                    </button>
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
