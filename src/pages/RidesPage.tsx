import { useState } from 'react';
import { ListPage } from '../components/ListPage';
import { StatusBadge, statusLabel } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { useStickyState } from '../lib/useStickyState';
import { formatDateTime, formatInr } from '../lib/format';

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
  paymentStatus?: string;
  payAt?: 'pickup' | 'drop' | null;
  paymentIssue?: {
    code: string;
    at: string;
    resolvedAt?: string | null;
    resolvedBy?: string | null;
    resolutionNote?: string | null;
  } | null;
  pilotCancelCount?: number;
};

const ISSUE_FILTER = '__payment_issue';
const ISSUE_LABEL: Record<string, string> = {
  receiver_refused: "Receiver didn't pay",
  rider_refused: "Rider didn't pay",
  other: 'Cash not collected',
};

type RideList = {
  items: RideRow[];
  page: number;
  limit: number;
  total: number;
};

export function RidesPage() {
  const [page, setPage] = useStickyState('rides_page', 1);
  const [status, setStatus] = useStickyState('rides_status', '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const limit = 20;

  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const issues = status === ISSUE_FILTER;
  if (status && !issues) qs.set('status', status);
  const { data, error, loading, reload } = useAdminQuery<RideList>(
    issues ? `/admin/rides/payment-issues?${qs}` : `/admin/rides?${qs}`,
  );

  async function resolveIssue() {
    if (!selectedId) return;
    if (note.trim().length < 3) {
      setResolveErr('Write what happened (e.g. "Sender paid by UPI").');
      return;
    }
    setBusy(true);
    setResolveErr(null);
    try {
      await adminFetch(`/admin/rides/${selectedId}/payment-issue/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      });
      setNote('');
      reload();
      detail.reload();
    } catch (e) {
      setResolveErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

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
            className="field"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value={ISSUE_FILTER}>Payment not collected</option>
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
                {statusLabel(s)}
              </option>
            ))}
          </select>
        }
      >
        <div className="surface overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Fare</th>
              </tr>
            </thead>
            <tbody>
              {!loading && (data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    No rides match these filters. Try another status or clear the filter.
                  </td>
                </tr>
              ) : null}
              {(data?.items ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer focus-visible:bg-violet-50"
                  tabIndex={0}
                  aria-label={`Open ride ${row.id}`}
                  onClick={() => setSelectedId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(row.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {row.createdAt ? formatDateTime(row.createdAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.serviceType}
                    {row.shakti ? (
                      <span className="badge badge-accent ml-2">Shakti</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                    {row.paymentIssue && !row.paymentIssue.resolvedAt ? (
                      <span className="badge badge-warn ml-2">
                        {ISSUE_LABEL[row.paymentIssue.code] ?? 'Cash not collected'}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.pickup?.name ?? '—'} → {row.drop?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatInr(row.fareTotalPaise)}</td>
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
                <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">Ride detail</h2>
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
                  <div className="mt-0.5">
                    <StatusBadge status={detail.data.status} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Fare</span>
                  <div>
                    {formatInr(detail.data.fareTotalPaise)} · {detail.data.paymentStatus ?? '—'}
                    {detail.data.payAt ? ` · parcel, pay at ${detail.data.payAt}` : ''}
                  </div>
                </div>
                {detail.data.pilotCancelCount ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                    {detail.data.pilotCancelCount === 1 ? 'A pilot' : `${detail.data.pilotCancelCount} pilots`} cancelled
                    after accepting; the ride was offered again automatically.
                  </div>
                ) : null}
                {detail.data.paymentIssue ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="font-semibold text-amber-900">
                      {ISSUE_LABEL[detail.data.paymentIssue.code] ?? 'Cash not collected'} ·{' '}
                      {formatInr(detail.data.fareTotalPaise)}
                    </div>
                    <div className="text-xs text-amber-800">
                      {formatDateTime(detail.data.paymentIssue.at)} · follow up with the sender / rider
                    </div>
                    {detail.data.paymentIssue.resolvedAt ? (
                      <div className="mt-2 text-sm text-slate-700">
                        Resolved by {detail.data.paymentIssue.resolvedBy} on{' '}
                        {formatDateTime(detail.data.paymentIssue.resolvedAt)}:{' '}
                        {detail.data.paymentIssue.resolutionNote}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs font-medium text-amber-900" htmlFor="resolve-note">
                          What happened? (required)
                        </label>
                        <input
                          id="resolve-note"
                          className="field w-full"
                          placeholder="e.g. Sender paid ₹50 by UPI"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        {resolveErr ? <p className="text-xs text-red-600">{resolveErr}</p> : null}
                        <button
                          type="button"
                          className="btn btn-warn btn-sm"
                          disabled={busy}
                          onClick={() => void resolveIssue()}
                        >
                          Mark resolved
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
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
                          {t.from ? `${statusLabel(t.from)} → ` : ''}
                          {statusLabel(t.to)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(t.at)} · {t.actor ?? 'system'}
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
                    className="btn btn-danger mt-4 w-full"
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
