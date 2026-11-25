import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Card, Field, Toggle, inputCls } from '../components/formKit';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { MsgToast } from '../components/Toaster';

/* ───────────── types ───────────── */

type AppKey = 'customer' | 'pilot';
type KycDoc = { id: string; label: string; required: boolean };

/** What the backend stores (subset used by this editor). */
type ConfigValue = {
  flags?: Record<string, boolean>;
  languages?: string[];
  home?: { tilesOrder?: string[]; recentPlacesEnabled?: boolean; promoSectionEnabled?: boolean };
  locationUpdateIntervalSec?: number;
  locationDistanceFilterM?: number;
  kycDocumentsByVehicle?: Record<string, KycDoc[]>;
};
type ConfigPayload = { key: string; version: number; value: ConfigValue };

/** Served by GET /admin/config/:key/meta — the backend owns the catalog and limits. */
type Meta = {
  flags: { key: string; label: string; description: string; default: boolean; risk?: 'money' | 'matching' }[];
  languages: { code: string; label: string }[];
  serviceTypes: string[];
  limits: {
    tilesOrder: { min: number; max: number };
    languages: { min: number; max: number };
    locationUpdateIntervalSec: { min: number; max: number };
    locationDistanceFilterM: { min: number; max: number };
    kyc: { maxDocsPerVehicle: number; idPattern: string; labelMax: number };
  };
};

type Form = {
  flags: Record<string, boolean>;
  languages: string[];
  tilesOrder: string[];
  recentPlacesEnabled: boolean;
  promoSectionEnabled: boolean;
  intervalSec: string;
  distanceM: string;
  kyc: Record<string, KycDoc[]>;
};

const RISK_LABEL = { money: 'Affects money', matching: 'Affects matching' } as const;

/* ───────────── mapping ───────────── */

function fromServer(meta: Meta, v: ConfigValue): Form {
  const flags: Record<string, boolean> = {};
  for (const f of meta.flags) flags[f.key] = v.flags?.[f.key] ?? f.default;
  // Keep flags the apps/ops use that are not in the catalog, so saving never silently drops them.
  for (const [k, on] of Object.entries(v.flags ?? {})) if (!(k in flags)) flags[k] = on;
  return {
    flags,
    languages: v.languages ?? ['en'],
    tilesOrder: v.home?.tilesOrder ?? [],
    recentPlacesEnabled: v.home?.recentPlacesEnabled ?? true,
    promoSectionEnabled: v.home?.promoSectionEnabled ?? true,
    intervalSec: String(v.locationUpdateIntervalSec ?? ''),
    distanceM: String(v.locationDistanceFilterM ?? ''),
    kyc: Object.fromEntries(
      meta.serviceTypes.map((t) => [t, (v.kycDocumentsByVehicle?.[t] ?? []).map((d) => ({ ...d }))]),
    ),
  };
}

function toServer(app: AppKey, f: Form): ConfigValue {
  if (app === 'customer') {
    return {
      flags: f.flags,
      languages: f.languages,
      home: {
        tilesOrder: f.tilesOrder,
        recentPlacesEnabled: f.recentPlacesEnabled,
        promoSectionEnabled: f.promoSectionEnabled,
      },
    };
  }
  return {
    flags: f.flags,
    languages: f.languages,
    locationUpdateIntervalSec: Number(f.intervalSec),
    locationDistanceFilterM: Number(f.distanceM),
    kycDocumentsByVehicle: Object.fromEntries(Object.entries(f.kyc).filter(([, docs]) => docs.length > 0)),
  };
}

type Errors = {
  languages?: string;
  tiles?: string;
  interval?: string;
  distance?: string;
  kyc: Record<string, Record<number, { id?: string; label?: string }> & { _?: string }>;
};

function validate(app: AppKey, f: Form, m: Meta): Errors {
  const e: Errors = { kyc: {} };
  if (f.languages.length < m.limits.languages.min) e.languages = 'Select at least one language';
  if (app === 'customer') {
    if (f.tilesOrder.length < m.limits.tilesOrder.min) e.tiles = 'Show at least one service tile';
  } else {
    const iv = m.limits.locationUpdateIntervalSec;
    const di = m.limits.locationDistanceFilterM;
    const n = Number(f.intervalSec);
    const d = Number(f.distanceM);
    if (f.intervalSec.trim() === '' || !Number.isInteger(n) || n < iv.min || n > iv.max) {
      e.interval = `Whole number from ${iv.min} to ${iv.max}`;
    }
    if (f.distanceM.trim() === '' || !Number.isInteger(d) || d < di.min || d > di.max) {
      e.distance = `Whole number from ${di.min} to ${di.max}`;
    }
    const idRe = new RegExp(m.limits.kyc.idPattern);
    for (const [vehicle, docs] of Object.entries(f.kyc)) {
      const seen = new Set<string>();
      const rows: Record<number, { id?: string; label?: string }> = {};
      docs.forEach((d, i) => {
        const row: { id?: string; label?: string } = {};
        if (!idRe.test(d.id)) row.id = 'a–z, 0–9, _ (start with a letter)';
        else if (seen.has(d.id)) row.id = 'Duplicate id';
        seen.add(d.id);
        const label = d.label.trim();
        if (!label) row.label = 'Required';
        else if (label.length > m.limits.kyc.labelMax) row.label = `Max ${m.limits.kyc.labelMax}`;
        if (row.id || row.label) rows[i] = row;
      });
      if (Object.keys(rows).length) e.kyc[vehicle] = rows as Errors['kyc'][string];
    }
  }
  return e;
}

const hasErrors = (e: Errors) =>
  Boolean(e.languages || e.tiles || e.interval || e.distance || Object.keys(e.kyc).length);

/* ───────────── diff ───────────── */

function flat(app: AppKey, f: Form, m: Meta): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, on] of Object.entries(f.flags)) {
    o[`Flag · ${m.flags.find((x) => x.key === k)?.label ?? k}`] = on ? 'ON' : 'off';
  }
  o.Languages = f.languages.join(', ') || '—';
  if (app === 'customer') {
    o['Home tiles (order)'] = f.tilesOrder.join(' → ') || '—';
    o['Recent places'] = f.recentPlacesEnabled ? 'ON' : 'off';
    o['Promo section'] = f.promoSectionEnabled ? 'ON' : 'off';
  } else {
    o['Location interval'] = `${f.intervalSec}s`;
    o['Location distance filter'] = `${f.distanceM}m`;
    for (const [v, docs] of Object.entries(f.kyc)) {
      o[`KYC · ${v}`] = docs.map((d) => `${d.label}${d.required ? '*' : ''} (${d.id})`).join(', ') || '—';
    }
  }
  return o;
}

/* ───────────── editor for one app ───────────── */

function AppConfigEditor({ app, onDirty }: { app: AppKey; onDirty: (d: boolean) => void }) {
  const key = app === 'customer' ? 'app_config_customer' : 'app_config_pilot';
  const cfgQ = useAdminQuery<ConfigPayload>(`/admin/config/${key}`);
  const metaQ = useAdminQuery<Meta>(`/admin/config/${key}/meta`);
  const meta = metaQ.data;

  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const uid = useId();

  const apply = useCallback(
    (p: ConfigPayload, m: Meta) => {
      const next = fromServer(m, p.value ?? {});
      setForm(next);
      setSaved(next);
      setVersion(p.version);
    },
    [app],
  );

  useEffect(() => {
    if (cfgQ.data && meta) apply(cfgQ.data, meta);
  }, [cfgQ.data, meta, apply]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const errors = useMemo(() => (form && meta ? validate(app, form, meta) : null), [app, form, meta]);
  const shown = touched ? errors : null;

  const confirmBody = useMemo(() => {
    if (!form || !saved || !meta) return '';
    const b = flat(app, saved, meta);
    const a = flat(app, form, meta);
    const lines = Object.keys(a)
      .filter((k) => a[k] !== b[k])
      .map((k) => `${k}: ${b[k] ?? '—'}  →  ${a[k]}`);
    const risky = meta.flags
      .filter((fl) => fl.risk && form.flags[fl.key] !== saved.flags[fl.key])
      .map((fl) => `⚠ ${fl.label}: ${RISK_LABEL[fl.risk!]} — takes effect for live users.`);
    return [...risky, ...(risky.length ? [''] : []), ...(lines.length ? lines : ['No visible changes.'])].join('\n');
  }, [app, form, saved, meta]);

  if (cfgQ.error || metaQ.error) {
    return (
      <div className="space-y-3">
        <div className="alert alert-danger">
          {cfgQ.error ?? metaQ.error}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            cfgQ.reload();
            metaQ.reload();
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!form || !saved || !meta || !errors) return <div className="text-sm text-slate-500">Loading…</div>;

  const patch = (p: Partial<Form>) => {
    setMsg(null);
    setForm((s) => (s ? { ...s, ...p } : s));
  };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const moveTile = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= form.tilesOrder.length) return;
    const next = [...form.tilesOrder];
    [next[i], next[j]] = [next[j]!, next[i]!];
    patch({ tilesOrder: next });
  };
  const patchDoc = (vehicle: string, i: number, p: Partial<KycDoc>) =>
    patch({ kyc: { ...form.kyc, [vehicle]: form.kyc[vehicle]!.map((d, k) => (k === i ? { ...d, ...p } : d)) } });

  function onSave() {
    setErr(null);
    setMsg(null);
    setTouched(true);
    if (hasErrors(errors!)) {
      setErr('Fix the highlighted issues before saving.');
      return;
    }
    if (dirty) setConfirmOpen(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      // No server-side version check on PATCH: detect a concurrent save ourselves.
      const latest = await adminFetch<ConfigPayload>(`/admin/config/${key}`);
      if (version !== null && latest.version !== version) {
        apply(latest, meta!);
        setErr(`Someone else saved this config (now version ${latest.version}). Their changes were loaded — review and save again.`);
        return;
      }
      const next = await adminFetch<ConfigPayload>(`/admin/config/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: toServer(app, form!) }),
      });
      apply(next, meta!);
      setTouched(false);
      setMsg(`Saved · version ${next.version}. Apps pick this up within about a minute.`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Save failed');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  function discard() {
    if (dirty && !window.confirm('Discard all unsaved changes?')) return;
    setForm(saved);
    setTouched(false);
    setErr(null);
    setMsg(null);
  }

  const id = (n: string) => `${uid}-${n}`;

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">Current version: {version}</p>
      {err ? (
        <div className="alert alert-danger" role="alert">
          {err}
        </div>
      ) : null}
      <MsgToast msg={msg} />

      <Card
        title="Feature flags"
        subtitle="Turn app features on or off for everyone. New features should stay off until tested."
      >
        <ul className="divide-y divide-slate-100">
          {Object.keys(form.flags).map((k) => {
            const m = meta.flags.find((x) => x.key === k);
            return (
              <li key={k} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                    {m?.label ?? k}
                    {m?.risk ? (
                      <span className="badge badge-warn">
                        {RISK_LABEL[m.risk]}
                      </span>
                    ) : null}
                    {!m ? (
                      <span className="badge">
                        Not in catalog
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m?.description ?? 'Stored flag with no description.'} <span className="text-slate-400">· {k}</span>
                  </p>
                </div>
                <Toggle
                  checked={form.flags[k] === true}
                  label={`${m?.label ?? k} flag`}
                  onChange={(v) => patch({ flags: { ...form.flags, [k]: v } })}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Languages" subtitle="Languages users can pick in the app.">
        <div className="flex flex-wrap gap-2">
          {meta.languages.map((l) => {
            const on = form.languages.includes(l.code);
            return (
              <label
                key={l.code}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                  on ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => patch({ languages: toggleIn(form.languages, l.code) })}
                />
                {l.label}
              </label>
            );
          })}
        </div>
        {shown?.languages ? <p className="text-xs text-red-600" role="alert">{shown.languages}</p> : null}
      </Card>

      {app === 'customer' ? (
        <Card title="Home screen" subtitle="Which service tiles appear, and in what order. Cities still control which services exist.">
          <ul className="space-y-2">
            {[...form.tilesOrder, ...meta.serviceTypes.filter((t) => !form.tilesOrder.includes(t))].map((t) => {
              const i = form.tilesOrder.indexOf(t);
              const on = i >= 0;
              return (
                <li key={t} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <input
                    id={id(`tile-${t}`)}
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      patch({ tilesOrder: on ? form.tilesOrder.filter((x) => x !== t) : [...form.tilesOrder, t] })
                    }
                  />
                  <label htmlFor={id(`tile-${t}`)} className={`flex-1 text-sm capitalize ${on ? '' : 'text-slate-400'}`}>
                    {t}
                  </label>
                  <button
                    type="button"
                    disabled={!on || i === 0}
                    aria-label={`Move ${t} up`}
                    onClick={() => moveTile(i, -1)}
                    className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={!on || i === form.tilesOrder.length - 1}
                    aria-label={`Move ${t} down`}
                    onClick={() => moveTile(i, 1)}
                    className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm disabled:opacity-30"
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ul>
          {shown?.tiles ? <p className="text-xs text-red-600" role="alert">{shown.tiles}</p> : null}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-700">Show recent places</p>
            <Toggle checked={form.recentPlacesEnabled} label="Recent places" onChange={(v) => patch({ recentPlacesEnabled: v })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-700">Show promo section</p>
              <p className="text-xs text-slate-500">Content is managed under Home promo.</p>
            </div>
            <Toggle checked={form.promoSectionEnabled} label="Promo section" onChange={(v) => patch({ promoSectionEnabled: v })} />
          </div>
        </Card>
      ) : (
        <>
          <Card title="Location updates" subtitle="How often an online pilot's location is sent. Lower values use more battery and data.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Update interval (seconds)"
                htmlFor={id('iv')}
                error={shown?.interval}
                hint={`${meta.limits.locationUpdateIntervalSec.min}–${meta.limits.locationUpdateIntervalSec.max}`}
              >
                <input
                  id={id('iv')}
                  inputMode="numeric"
                  className={inputCls(!!shown?.interval)}
                  value={form.intervalSec}
                  onChange={(e) => patch({ intervalSec: e.target.value.replace(/[^\d]/g, '') })}
                />
              </Field>
              <Field
                label="Distance filter (metres)"
                htmlFor={id('di')}
                error={shown?.distance}
                hint={`${meta.limits.locationDistanceFilterM.min}–${meta.limits.locationDistanceFilterM.max}`}
              >
                <input
                  id={id('di')}
                  inputMode="numeric"
                  className={inputCls(!!shown?.distance)}
                  value={form.distanceM}
                  onChange={(e) => patch({ distanceM: e.target.value.replace(/[^\d]/g, '') })}
                />
              </Field>
            </div>
          </Card>

          <Card
            title="KYC documents by vehicle"
            subtitle="Documents a pilot must upload during onboarding. Changing an id affects documents already uploaded under it."
          >
            {meta.serviceTypes.map((v) => {
              const docs = form.kyc[v] ?? [];
              const rowErr = shown?.kyc[v] ?? {};
              return (
                <div key={v} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold capitalize text-slate-800">{v}</p>
                    <button
                      type="button"
                      disabled={docs.length >= meta.limits.kyc.maxDocsPerVehicle}
                      onClick={() => patch({ kyc: { ...form.kyc, [v]: [...docs, { id: '', label: '', required: true }] } })}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      + Add document
                    </button>
                  </div>
                  {docs.length === 0 ? <p className="text-xs text-slate-400">No documents required.</p> : null}
                  <div className="space-y-2">
                    {docs.map((d, i) => {
                      const re = (rowErr as Record<number, { id?: string; label?: string }>)[i];
                      return (
                        <div key={i} className="grid grid-cols-[110px_1fr_auto_auto] items-start gap-2">
                          <div>
                            <input
                              aria-label={`${v} document ${i + 1} id`}
                              className={inputCls(!!re?.id)}
                              value={d.id}
                              maxLength={30}
                              placeholder="id"
                              onChange={(e) => patchDoc(v, i, { id: e.target.value.toLowerCase() })}
                            />
                            {re?.id ? <p className="mt-0.5 text-[11px] text-red-600">{re.id}</p> : null}
                          </div>
                          <div>
                            <input
                              aria-label={`${v} document ${i + 1} label`}
                              className={inputCls(!!re?.label)}
                              value={d.label}
                              maxLength={meta.limits.kyc.labelMax}
                              placeholder="Label shown to pilot"
                              onChange={(e) => patchDoc(v, i, { label: e.target.value })}
                            />
                            {re?.label ? <p className="mt-0.5 text-[11px] text-red-600">{re.label}</p> : null}
                          </div>
                          <label className="flex items-center gap-1 pt-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={d.required}
                              onChange={(e) => patchDoc(v, i, { required: e.target.checked })}
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove ${v} document ${i + 1}`}
                            onClick={() => patch({ kyc: { ...form.kyc, [v]: docs.filter((_, k) => k !== i) } })}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSave}
          className="btn btn-primary"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={discard}
          className="btn btn-secondary"
        >
          Discard
        </button>
        {dirty ? <span className="text-xs text-amber-600">Unsaved changes</span> : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Confirm ${app} app config change`}
        body={confirmBody}
        confirmLabel={saving ? 'Saving…' : 'Save changes'}
        onCancel={() => !saving && setConfirmOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}

/* ───────────── page ───────────── */

export function AppConfigPage() {
  const [which, setWhich] = useState<AppKey>('customer');
  const [dirty, setDirty] = useState(false);

  function switchTo(a: AppKey) {
    if (a === which) return;
    if (dirty && !window.confirm('You have unsaved changes. Discard them and switch?')) return;
    setWhich(a);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">{which === 'customer' ? 'Customer' : 'Pilot'} app config</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {which === 'customer'
              ? 'Feature flags, languages and home screen layout.'
              : 'Feature flags, languages, location updates and KYC documents.'}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm" role="tablist">
          {(['customer', 'pilot'] as AppKey[]).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={which === a}
              onClick={() => switchTo(a)}
              className={`rounded-full px-4 py-1.5 capitalize ${which === a ? 'bg-[var(--prila-ink)] text-white shadow-sm' : 'text-slate-600'}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <AppConfigEditor key={which} app={which} onDirty={setDirty} />
    </div>
  );
}
