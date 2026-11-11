import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';

type Payout = {
  id: string;
  pilotId: string;
  amountPaise: number;
  status: string;
  method?: string;
  upiId?: string;
  createdAt?: string;
};

type PayoutList = { items: Payout[]; page: number; limit: number; total: number };

function inr(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

export function PayoutsPage() {
  const [page, setPage] = useStickyState('payouts_page', 1);
  const [status, setStatus] = useStickyState('payouts_status', 'requested');
  const [selected, setSelected] = useState<Payout | null>(null);
  const [action, setAction] = useState<'approve' | 'pay' | 'reject' | null>(null);
  const limit = 20;
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  const { data, error, loading, reload } = useAdminQuery<PayoutList>(`/admin/payouts?${qs}`);

  async function run() {
    if (!selected || !action) return;
    await adminFetch(`/admin/payouts/${selected.id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    setAction(null);
    setSelected(null);
    reload();
  }

  return (
    <>
      <ListPage
        title="Payouts"
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
            {['requested', 'approved', 'paid', 'rejected'].map((s) => (
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
                <th className="px-4 py-3">Pilot</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 break-all text-xs">{row.pilotId}</td>
                  <td className="px-4 py-3 font-medium">{inr(row.amountPaise)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 space-x-2">
                    {row.status === 'requested' ? (
                      <>
                        <button
                          type="button"
                          className="text-violet-700"
                          onClick={() => {
                            setSelected(row);
                            setAction('approve');
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => {
                            setSelected(row);
                            setAction('reject');
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {row.status === 'approved' || row.status === 'requested' ? (
                      <button
                        type="button"
                        className="text-emerald-700"
                        onClick={() => {
                          setSelected(row);
                          setAction('pay');
                        }}
                      >
                        Mark paid
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListPage>

      <ConfirmDialog
        open={Boolean(action && selected)}
        title={`${action} payout?`}
        body={selected ? `${inr(selected.amountPaise)} for pilot ${selected.pilotId}` : ''}
        confirmLabel="Confirm"
        onCancel={() => {
          setAction(null);
          setSelected(null);
        }}
        onConfirm={() => void run()}
      />
    </>
  );
}
