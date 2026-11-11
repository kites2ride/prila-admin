import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';

type PilotRow = {
  id: string;
  phone: string;
  name?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  kycStatus?: string;
  online?: boolean;
  status: string;
  suspendReason?: string;
  ratingAvg?: number;
  ratingCount?: number;
  duesPaise: number;
  balancePaise: number;
  lifetimeTrips: number;
  createdAt?: string;
};

type PilotList = { items: PilotRow[]; page: number; limit: number; total: number };

type Wallet = {
  balancePaise: number;
  duesPaise: number;
  lifetimeGrossPaise: number;
  lifetimeNetPaise: number;
  lifetimeCommissionPaise: number;
  lifetimeTrips: number;
};

function inr(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function PilotsPage() {
  const [page, setPage] = useStickyState('pilots_page', 1);
  const [status, setStatus] = useStickyState('pilots_status', '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [unsuspendOpen, setUnsuspendOpen] = useState(false);
  const [duesOpen, setDuesOpen] = useState(false);
  const [duesRupees, setDuesRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const limit = 20;

  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const { data, error, loading, reload } = useAdminQuery<PilotList>(`/admin/pilots?${qs}`);
  const walletQ = useAdminQuery<Wallet>(selectedId ? `/admin/pilots/${selectedId}/wallet` : null);
  const selected = data?.items.find((p) => p.id === selectedId) ?? null;

  async function suspend() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/pilots/${selectedId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Ops suspension' }),
      });
      setSuspendOpen(false);
      reload();
      walletQ.reload();
    } finally {
      setBusy(false);
    }
  }

  async function unsuspend() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/pilots/${selectedId}/unsuspend`, { method: 'POST' });
      setUnsuspendOpen(false);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function settleDues() {
    if (!selectedId) return;
    const rupees = Number(duesRupees);
    if (!Number.isFinite(rupees) || rupees <= 0) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/pilots/${selectedId}/dues/settle`, {
        method: 'POST',
        body: JSON.stringify({ amountPaise: Math.round(rupees * 100), note: 'Ops dues settle' }),
      });
      setDuesOpen(false);
      setDuesRupees('');
      reload();
      walletQ.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ListPage
        title="Pilots"
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
            <option value="">All</option>
            {['active', 'suspended', 'deleted'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pilot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Dues</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-t border-slate-100 ${
                      selectedId === row.id ? 'bg-violet-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name || row.phone}</div>
                      <div className="text-xs text-slate-500">
                        {row.vehicleType ?? '—'} · {row.kycStatus ?? '—'}
                        {row.online ? ' · online' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {row.ratingAvg != null ? `${row.ratingAvg.toFixed(1)} (${row.ratingCount ?? 0})` : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{inr(row.duesPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a pilot to view wallet and actions.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">{selected.name || selected.phone}</div>
                  <div className="text-xs break-all text-slate-500">{selected.id}</div>
                  {selected.suspendReason ? (
                    <div className="mt-1 text-sm text-red-600">Suspended: {selected.suspendReason}</div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Balance</div>
                    <div className="font-semibold">{inr(walletQ.data?.balancePaise ?? selected.balancePaise)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Dues</div>
                    <div className="font-semibold">{inr(walletQ.data?.duesPaise ?? selected.duesPaise)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Lifetime trips</div>
                    <div className="font-semibold">{walletQ.data?.lifetimeTrips ?? selected.lifetimeTrips}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Lifetime net</div>
                    <div className="font-semibold">{inr(walletQ.data?.lifetimeNetPaise ?? 0)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.status === 'suspended' ? (
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                      disabled={busy}
                      onClick={() => setUnsuspendOpen(true)}
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white"
                      disabled={busy}
                      onClick={() => setSuspendOpen(true)}
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    disabled={busy || (walletQ.data?.duesPaise ?? selected.duesPaise) <= 0}
                    onClick={() => setDuesOpen(true)}
                  >
                    Settle dues
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </ListPage>

      <ConfirmDialog
        open={suspendOpen}
        title="Suspend pilot"
        body="Pilot will be forced offline and cannot go online until unsuspended."
        confirmLabel={busy ? 'Working…' : 'Suspend'}
        onConfirm={() => void suspend()}
        onCancel={() => setSuspendOpen(false)}
      />
      <ConfirmDialog
        open={unsuspendOpen}
        title="Unsuspend pilot"
        body="Restore active status so the pilot can go online (subject to quality gate)."
        confirmLabel={busy ? 'Working…' : 'Unsuspend'}
        onConfirm={() => void unsuspend()}
        onCancel={() => setUnsuspendOpen(false)}
      />
      {duesOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Settle dues</h2>
            <p className="mt-2 text-sm text-slate-600">
              Outstanding: {inr(walletQ.data?.duesPaise ?? selected?.duesPaise ?? 0)}
            </p>
            <label className="mt-3 block text-sm">
              Amount (₹)
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={duesRupees}
                onChange={(e) => setDuesRupees(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setDuesOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white"
                disabled={busy}
                onClick={() => void settleDues()}
              >
                {busy ? 'Working…' : 'Settle'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
