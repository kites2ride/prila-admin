import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { desktopAlertsState, enableDesktopAlerts, KYC_CHANGED_EVENT } from '../lib/kycAlerts';
import { useAdminQuery } from '../lib/useAdminQuery';

type Tab = 'pending' | 'approved' | 'rejected';
type Row = {
  id: string;
  name: string | null;
  phone: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectReason: string | null;
};
type Doc = { docId: string; label: string; isPdf: boolean; url: string | null; uploadedAt: string | null };
type Detail = {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  vehicleType: string | null;
  vehicleNumber: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectReason: string | null;
  rejectedDocs: string[];
  documents: Doc[];
  missingRequired: string[];
  linksExpireInSec: number;
};

/** Common reasons — one click fills the box; the admin can still edit. */
const QUICK_REASONS = [
  'Photo is blurred or cut off — please take a clear photo',
  'Document has expired — please upload a valid one',
  'Name does not match across documents',
  'Wrong document uploaded',
  'Vehicle number does not match the RC',
  'Selfie is not clear — face must be fully visible',
];

function when(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleString();
}

function plate(v: string | null) {
  return v ? v.replace(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/, '$1 $2 $3 $4').replace(/\s+/g, ' ') : '—';
}

export function KycReviewPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useAdminQuery<{ items: Row[]; total: number }>(`/admin/kyc?status=${tab}&limit=50`);
  const detail = useAdminQuery<Detail>(selectedId ? `/admin/kyc/${selectedId}` : null);

  const [zoom, setZoom] = useState<Doc | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [badDocs, setBadDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(desktopAlertsState());

  // Document links expire after 5 minutes — quietly fetch fresh ones while the review is open.
  useEffect(() => {
    if (!selectedId) return;
    const t = window.setInterval(() => detail.reload(), 4 * 60_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Pending list refreshes with the menu badge (new submissions appear without reload).
  useEffect(() => {
    if (tab !== 'pending') return;
    const t = window.setInterval(() => list.reload(), 30_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function open(id: string) {
    setSelectedId(id);
    setRejecting(false);
    setReason('');
    setBadDocs([]);
    setErr(null);
  }

  function done(text: string) {
    setMsg(text);
    setSelectedId(null);
    setRejecting(false);
    list.reload();
    window.dispatchEvent(new Event(KYC_CHANGED_EVENT));
  }

  async function approve() {
    if (!selectedId) return;
    setBusy(true);
    setErr(null);
    try {
      await adminFetch(`/admin/kyc/${selectedId}/approve`, { method: 'POST' });
      setApproveOpen(false);
      done(`${detail.data?.name ?? 'Pilot'} approved. They can go online now.`);
    } catch (e) {
      setApproveOpen(false);
      setErr(e instanceof Error ? e.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!selectedId) return;
    if (reason.trim().length < 5) {
      setErr('A reason is required. The pilot will see it exactly as you write it.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await adminFetch(`/admin/kyc/${selectedId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim(), docIds: badDocs }),
      });
      done(`${detail.data?.name ?? 'Pilot'} rejected. They will see your reason in the app.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reject');
    } finally {
      setBusy(false);
    }
  }

  const d = detail.data;
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">KYC review</h1>
        <div className="flex rounded-xl border border-[var(--prila-border)] bg-white p-1 text-sm" role="tablist">
          {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setSelectedId(null);
              }}
              className={`rounded-lg px-3 py-1.5 capitalize ${tab === t ? 'bg-violet-50 font-semibold text-[var(--prila-purple)]' : 'text-slate-600'}`}
            >
              {t === 'pending' ? `Waiting${list.data && tab === 'pending' ? ` (${list.data.total})` : ''}` : t}
            </button>
          ))}
        </div>
        {alerts === 'default' ? (
          <button
            type="button"
            className="ml-auto rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-[var(--prila-purple)]"
            onClick={async () => setAlerts(await enableDesktopAlerts())}
          >
            Turn on desktop alerts for new KYC
          </button>
        ) : alerts === 'denied' ? (
          <span className="ml-auto text-xs text-[var(--prila-muted)]">
            Desktop alerts are blocked in this browser. The red count in the menu still updates.
          </span>
        ) : null}
      </div>

      {msg ? <p className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-800">{msg}</p> : null}
      {list.error ? <p className="text-sm text-red-600">{list.error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <ul className="space-y-2">
          {!list.loading && items.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-[var(--prila-border)] p-6 text-center text-sm text-[var(--prila-muted)]">
              {tab === 'pending' ? 'Nothing waiting. New submissions appear here automatically.' : 'Nobody here yet.'}
            </li>
          ) : null}
          {items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => open(r.id)}
                className={`w-full rounded-2xl border bg-white p-3 text-left text-sm transition-colors ${
                  selectedId === r.id ? 'border-violet-300 ring-1 ring-violet-200' : 'border-[var(--prila-border)] hover:bg-[var(--prila-bg)]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{r.name ?? 'No name'}</span>
                  <span className="text-xs text-[var(--prila-muted)]">
                    {tab === 'pending' ? when(r.submittedAt) : when(r.reviewedAt)}
                  </span>
                </div>
                <div className="mt-0.5 text-[var(--prila-muted)]">
                  <span className="capitalize">{r.vehicleType ?? '—'}</span> · <span className="font-mono">{plate(r.vehicleNumber)}</span>
                </div>
                {tab === 'rejected' && r.rejectReason ? <div className="mt-1 text-xs text-red-700">{r.rejectReason}</div> : null}
              </button>
            </li>
          ))}
        </ul>

        <section className="min-h-[420px] rounded-2xl border border-[var(--prila-border)] bg-white p-5">
          {!selectedId ? (
            <p className="text-sm text-[var(--prila-muted)]">Pick a pilot on the left to see their documents.</p>
          ) : detail.loading && !d ? (
            <p className="text-sm text-[var(--prila-muted)]">Loading…</p>
          ) : detail.error ? (
            <p className="text-sm text-red-600">{detail.error}</p>
          ) : d ? (
            <div className="space-y-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{d.name ?? 'No name'}</h2>
                  <p className="text-sm text-[var(--prila-muted)]">
                    {d.phone} · {d.city ?? 'No city'} · <span className="capitalize">{d.vehicleType}</span>
                  </p>
                  <p className="mt-2 inline-block rounded-lg border-2 border-slate-800 bg-amber-50 px-3 py-1 font-mono text-lg font-bold tracking-widest">
                    {plate(d.vehicleNumber)}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--prila-muted)]">
                  Sent {when(d.submittedAt)}
                  {d.reviewedBy ? <div>Reviewed by {d.reviewedBy}</div> : null}
                </div>
              </header>

              {d.missingRequired.length ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Missing: {d.missingRequired.join(', ')}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {d.documents.map((doc) => {
                  const flagged = badDocs.includes(doc.docId) || (d.status === 'rejected' && d.rejectedDocs.includes(doc.docId));
                  return (
                    <figure
                      key={doc.docId}
                      className={`overflow-hidden rounded-xl border ${flagged ? 'border-red-400 ring-2 ring-red-200' : 'border-[var(--prila-border)]'}`}
                    >
                      <button
                        type="button"
                        className="block aspect-[4/3] w-full bg-slate-100"
                        onClick={() => (doc.isPdf ? doc.url && window.open(doc.url, '_blank', 'noopener') : setZoom(doc))}
                        aria-label={`Open ${doc.label}`}
                        disabled={!doc.url}
                      >
                        {!doc.url ? (
                          <span className="text-xs text-[var(--prila-muted)]">File storage not configured</span>
                        ) : doc.isPdf ? (
                          <span className="text-sm font-medium text-[var(--prila-purple)]">Open PDF ↗</span>
                        ) : (
                          <img src={doc.url} alt={doc.label} className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </button>
                      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="font-medium">{doc.label}</span>
                        {rejecting ? (
                          <label className="flex items-center gap-1 text-xs text-red-700">
                            <input
                              type="checkbox"
                              className="accent-red-600"
                              checked={badDocs.includes(doc.docId)}
                              onChange={(e) =>
                                setBadDocs((v) => (e.target.checked ? [...v, doc.docId] : v.filter((x) => x !== doc.docId)))
                              }
                            />
                            Wrong
                          </label>
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>

              {d.status === 'rejected' && d.rejectReason ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Rejected: {d.rejectReason}</p>
              ) : null}

              {d.status === 'pending' ? (
                rejecting ? (
                  <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/40 p-4">
                    <label htmlFor="kyc-reason" className="block text-sm font-semibold">
                      Why are you rejecting? <span className="text-red-600">(required — the pilot sees this)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_REASONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs hover:bg-red-50"
                          onClick={() => setReason(q)}
                        >
                          {q.split(' — ')[0]}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="kyc-reason"
                      rows={3}
                      maxLength={500}
                      className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
                      placeholder="e.g. RC photo is blurred — please upload a clear photo"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <p className="text-xs text-[var(--prila-muted)]">Tick “Wrong” on the documents the pilot must upload again.</p>
                    {err ? <p className="text-sm text-red-600">{err}</p> : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        disabled={busy || reason.trim().length < 5}
                        onClick={() => void reject()}
                      >
                        {busy ? 'Rejecting…' : 'Reject documents'}
                      </button>
                      <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setRejecting(false)}>
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {err ? <p className="w-full text-sm text-red-600">{err}</p> : null}
                    <button
                      type="button"
                      className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy}
                      onClick={() => setApproveOpen(true)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700"
                      onClick={() => {
                        setRejecting(true);
                        setErr(null);
                      }}
                    >
                      Reject…
                    </button>
                  </div>
                )
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {zoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)} role="dialog" aria-label={zoom.label}>
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.url ?? ''} alt={zoom.label} className="max-h-[85vh] w-auto rounded-xl bg-white object-contain" />
            <figcaption className="mt-2 flex justify-between text-sm text-white">
              <span>{zoom.label}</span>
              <button type="button" className="underline" onClick={() => setZoom(null)}>
                Close
              </button>
            </figcaption>
          </figure>
        </div>
      ) : null}

      <ConfirmDialog
        open={approveOpen}
        title={`Approve ${d?.name ?? 'this pilot'}?`}
        body="They will be able to go online and take rides right away. Their selfie becomes the photo riders see."
        confirmLabel={busy ? 'Approving…' : 'Approve'}
        onCancel={() => setApproveOpen(false)}
        onConfirm={() => void approve()}
      />
    </div>
  );
}
