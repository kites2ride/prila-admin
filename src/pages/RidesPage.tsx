import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';

type RideRow = {
  id: string;
  status: string;
  serviceType: string;
  fareTotalPaise?: number;
  shakti?: boolean;
  pickup?: { name?: string };
  drop?: { name?: string };
  createdAt?: string;
  timeline?: Array<{ at: string; from?: string; to: string; actor?: string }>;
  startOtp?: string;
  riderId?: string;
  pilotId?: string | null;
};

type RideList = {
  items: RideRow[];
  page: number;
  limit: number;
  total: number;
};

function inr(paise?: number) {
  return `₹${((paise ?? 0) / 100).toFixed(0)}`;
}

export function RidesPage() {
  const [page, setPage] = useStickyState('rides_page', 1);
  const [status, setStatus] = useStickyState('rides_status', '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const limit = 20;

  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const { data, error, loading, reload } = useAdminQuery<RideList>(`/admin/rides?${qs}`);

  const detail = useAdminQuery<RideRow>(selectedId ? `/admin/rides/${selectedId}` : null);

  async function confirmCancel() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/rides/${selectedId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reasonCode: 'admin_cancel', reasonText: 'Ops cancel' }),
      });
      setCancelOpen(false);
      reload();
      detail.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ListPage
        title="Rides"
        page={page}
        limit={limit}
        total={data?.total ?? 0}
        onPage={setPage}
        loading={loading}
        error={error}
        filters={
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {[
              'searching',
              'pilot_arriving',
              'pilot_arrived',
              'in_progress',
              'completed',
              'no_pilot_found',
              'cancelled_by_rider',
              'cancelled_by_pilot',
              'cancelled_by_system',
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        }
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Fare</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-violet-50/40"
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-4 py-3 text-slate-500">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.serviceType}
                    {row.shakti ? (
                      <span className="ml-2 rounded-full bg-pink-50 px-2 py-0.5 text-xs text-pink-700">Shakti</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.status}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.pickup?.name ?? '—'} → {row.drop?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">{inr(row.fareTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPage>

      {selectedId ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelectedId(null)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Ride detail</h2>
                <p className="text-xs text-slate-500 break-all">{selectedId}</p>
              </div>
              <button type="button" className="text-sm text-slate-500" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            {detail.loading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
            {detail.error ? <p className="mt-4 text-sm text-red-600">{detail.error}</p> : null}
            {detail.data ? (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="text-slate-500">Status</span>
                  <div className="font-semibold">{detail.data.status}</div>
                </div>
                <div>
                  <span className="text-slate-500">Fare</span>
                  <div>{inr(detail.data.fareTotalPaise)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Rider / Pilot</span>
                  <div className="break-all">{detail.data.riderId}</div>
                  <div className="break-all text-slate-600">{detail.data.pilotId ?? '—'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Timeline</span>
                  <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3">
                    {(detail.data.timeline ?? []).map((t, i) => (
                      <li key={`${t.at}-${i}`}>
                        <div className="font-medium">
                          {t.from ? `${t.from} → ` : ''}
                          {t.to}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(t.at).toLocaleString()} · {t.actor ?? 'system'}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                {!['completed', 'paid', 'cancelled_by_rider', 'cancelled_by_pilot', 'cancelled_by_system', 'no_pilot_found'].includes(
                  detail.data.status,
                ) ? (
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
                    onClick={() => setCancelOpen(true)}
                    disabled={busy}
                  >
                    Cancel ride
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this ride?"
        body="This notifies rider and pilot and marks the ride cancelled by system/admin."
        confirmLabel={busy ? 'Cancelling…' : 'Cancel ride'}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void confirmCancel()}
      />
    </>
  );
}
