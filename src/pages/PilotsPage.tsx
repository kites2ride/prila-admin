import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { Avatar, StatusBadge, statusLabel } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';
import { formatInr } from '../lib/format';

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
            className="field"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['active', 'suspended', 'deleted'].map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="surface overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pilot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Rating</th>
                  <th className="px-4 py-3 text-right">Dues</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer focus-visible:bg-violet-50 ${selectedId === row.id ? 'bg-violet-50' : ''}`}
                    tabIndex={0}
                    aria-selected={selectedId === row.id}
                    onClick={() => setSelectedId(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(row.id);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name || row.phone || '?'} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[var(--prila-ink)]">{row.name || row.phone}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="capitalize">{row.vehicleType ?? '—'}</span>
                            <StatusBadge status={row.kycStatus ? `KYC ${row.kycStatus}` : null} />
                            {row.online ? <span className="badge badge-success">Online</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.ratingAvg != null ? `${row.ratingAvg.toFixed(1)} (${row.ratingCount ?? 0})` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatInr(row.duesPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="surface p-4">
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
                    <div className="font-semibold">{formatInr(walletQ.data?.balancePaise ?? selected.balancePaise)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Dues</div>
                    <div className="font-semibold">{formatInr(walletQ.data?.duesPaise ?? selected.duesPaise)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Lifetime trips</div>
                    <div className="font-semibold">{walletQ.data?.lifetimeTrips ?? selected.lifetimeTrips}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Lifetime net</div>
                    <div className="font-semibold">{formatInr(walletQ.data?.lifetimeNetPaise ?? 0)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.status === 'suspended' ? (
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={busy}
                      onClick={() => setUnsuspendOpen(true)}
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() => setSuspendOpen(true)}
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
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
            <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">Settle dues</h2>
            <p className="mt-2 text-sm text-slate-600">
              Outstanding: {formatInr(walletQ.data?.duesPaise ?? selected?.duesPaise ?? 0)}
            </p>
            <label className="mt-3 block text-sm">
              Amount (₹)
              <input
                className="field mt-1 w-full"
                value={duesRupees}
                onChange={(e) => setDuesRupees(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDuesOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
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
