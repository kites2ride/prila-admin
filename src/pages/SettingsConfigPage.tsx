import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Card, Toggle, inputCls } from '../components/formKit';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';

/* ───────────── types (mirror backend settingsCatalog.ts) ───────────── */

type Risk = 'money' | 'matching' | 'cost' | 'pilots' | 'users';
type FieldSpec = {
  key: string;
  label: string;
  description: string;
  group: string;
  type: 'boolean' | 'int' | 'number' | 'text' | 'enum' | 'list';
  default: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  maxLength?: number;
  pattern?: string;
  patternHint?: string;
  format?: 'https-url';
  optional?: boolean;
  multiline?: boolean;
  placeholder?: string;
  requiredWhen?: string;
  maxItems?: number;
  risk?: Risk;
  restart?: boolean;
};
type SurgeRow = { minRatio: number; multiplier: number };
type Meta = {
  fields: FieldSpec[];
  surgeTable?: {
    maxRows: number;
    minRatio: { min: number; max: number };
    multiplier: { min: number; max: number };
  };
};
type ConfigKey = 'dispatch' | 'surge' | 'maps' | 'pilot_quality' | 'support' | 'maintenance' | 'zones';
type ConfigPayload = { key: string; version: number; value: Record<string, unknown> };

/** Text for every field ('true'/'false' for booleans); the surge table is held separately. */
type Form = { values: Record<string, string>; table: { minRatio: string; multiplier: string }[] };

type Props = {
  title: string;
  configKey: ConfigKey;
  description: string;
  /** Extra warning shown on top (e.g. "this is live money logic"). */
  banner?: ReactNode;
  /** Optional cross-field rules. Return { fieldKey: message }. Receives parsed numbers/strings. */
  crossChecks?: (v: Record<string, string>) => Record<string, string>;
  /** Require typing a phrase to save when `when(before, after)` is true (user-blocking changes). */
  strongConfirm?: {
    when: (before: Record<string, string>, after: Record<string, string>) => boolean;
    phrase: string;
    note: string;
  };
};

const RISK_LABEL: Record<Risk, string> = {
  money: 'Affects fares',
  matching: 'Affects matching',
  cost: 'Affects Google cost',
  pilots: 'Affects pilots',
  users: 'Affects all users',
};
const RISK_CLASS: Record<Risk, string> = {
  money: 'bg-rose-50 text-rose-700',
  matching: 'bg-amber-50 text-amber-700',
  cost: 'bg-sky-50 text-sky-700',
  pilots: 'bg-orange-50 text-orange-700',
  users: 'bg-red-50 text-red-700',
};

/* ───────────── helpers ───────────── */

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function setPath(root: Record<string, unknown>, path: string, v: unknown) {
  const parts = path.split('.');
  let cur = root;
  for (const p of parts.slice(0, -1)) cur = (cur[p] ??= {}) as Record<string, unknown>;
  cur[parts[parts.length - 1]!] = v;
}

function fromServer(meta: Meta, value: Record<string, unknown>): Form {
  const values: Record<string, string> = {};
  for (const f of meta.fields) {
    const raw = getPath(value, f.key);
    if (f.type === 'list') {
      values[f.key] = JSON.stringify(Array.isArray(raw) ? raw.map(String) : JSON.parse(String(f.default)));
    } else {
      values[f.key] = String(raw ?? f.default);
    }
  }
  const t = Array.isArray(value.table) ? (value.table as SurgeRow[]) : [];
  return { values, table: t.map((r) => ({ minRatio: String(r.minRatio), multiplier: String(r.multiplier) })) };
}

function parseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** `base` is the stored value: keys the form does not manage (e.g. legacy fields) are preserved on save. */
function toServer(meta: Meta, f: Form, base: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = structuredClone(base);
  for (const spec of meta.fields) {
    const raw = f.values[spec.key] ?? '';
    const v =
      spec.type === 'boolean'
        ? raw === 'true'
        : spec.type === 'int' || spec.type === 'number'
          ? Number(raw)
          : spec.type === 'list'
            ? parseList(raw).map((x) => x.trim())
            : raw.trim();
    setPath(out, spec.key, v);
  }
  if (meta.surgeTable) {
    out.table = f.table.map((r) => ({ minRatio: Number(r.minRatio), multiplier: Number(r.multiplier) }));
  }
  return out;
}

const isNumStr = (s: string) => s.trim() !== '' && Number.isFinite(Number(s));

function isHttps(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

function checkText(f: FieldSpec, v: string): string | undefined {
  if (f.maxLength && v.length > f.maxLength) return `Max ${f.maxLength} characters`;
  if (f.pattern && !new RegExp(f.pattern).test(v)) return f.patternHint ?? 'Invalid format';
  if (f.format === 'https-url' && !isHttps(v)) return f.patternHint ?? 'Must be a valid https:// URL';
  return undefined;
}

function validateField(f: FieldSpec, raw: string, all: Record<string, string>): string | undefined {
  if (f.type === 'boolean') return undefined;
  if (f.type === 'enum') return f.options?.some((o) => o.value === raw) ? undefined : 'Choose an option';
  if (f.type === 'text') {
    const v = raw.trim();
    if (!v) {
      if (f.requiredWhen && all[f.requiredWhen] === 'true') return 'Required while this is switched on';
      return f.optional ? undefined : 'Required';
    }
    return checkText(f, v);
  }
  if (f.type === 'list') {
    const items = parseList(raw).map((x) => x.trim());
    if (f.maxItems && items.length > f.maxItems) return `At most ${f.maxItems} entries`;
    for (const it of items) {
      if (!it) return 'Fill in or remove the empty entry';
      const e = checkText(f, it);
      if (e) return `"${it}": ${e}`;
    }
    if (new Set(items).size !== items.length) return 'Duplicate entry';
    return undefined;
  }
  if (!isNumStr(raw)) return 'Enter a number';
  const n = Number(raw);
  if (f.type === 'int' && !Number.isInteger(n)) return 'Whole number only';
  if (f.min !== undefined && n < f.min) return `Minimum is ${f.min}`;
  if (f.max !== undefined && n > f.max) return `Maximum is ${f.max}`;
  return undefined;
}

type TableErrors = { _?: string; rows: Record<number, { minRatio?: string; multiplier?: string }> };

function validateTable(meta: Meta, f: Form, maxMultiplierRaw: string): TableErrors {
  const out: TableErrors = { rows: {} };
  const lim = meta.surgeTable!;
  if (f.table.length < 1) out._ = 'Add at least one row';
  if (f.table.length > lim.maxRows) out._ = `At most ${lim.maxRows} rows`;
  const maxM = isNumStr(maxMultiplierRaw) ? Number(maxMultiplierRaw) : lim.multiplier.max;
  f.table.forEach((r, i) => {
    const e: { minRatio?: string; multiplier?: string } = {};
    const ratio = Number(r.minRatio);
    const mult = Number(r.multiplier);
    if (!isNumStr(r.minRatio)) e.minRatio = 'Number';
    else if (ratio < lim.minRatio.min || ratio > lim.minRatio.max) e.minRatio = `${lim.minRatio.min}–${lim.minRatio.max}`;
    else if (i === 0 && ratio !== 0) e.minRatio = 'First row must be 0';
    else if (i > 0 && isNumStr(f.table[i - 1]!.minRatio) && ratio <= Number(f.table[i - 1]!.minRatio)) e.minRatio = 'Must increase';
    if (!isNumStr(r.multiplier)) e.multiplier = 'Number';
    else if (mult < lim.multiplier.min || mult > lim.multiplier.max) e.multiplier = `${lim.multiplier.min}–${lim.multiplier.max}`;
    else if (mult > maxM) e.multiplier = `Above max ×${maxM}`;
    else if (i > 0 && isNumStr(f.table[i - 1]!.multiplier) && mult < Number(f.table[i - 1]!.multiplier)) e.multiplier = 'Must not decrease';
    if (e.minRatio || e.multiplier) out.rows[i] = e;
  });
  return out;
}

function show(f: FieldSpec, raw: string | undefined): string {
  if (raw === undefined) return '—';
  if (f.type === 'boolean') return raw === 'true' ? 'ON' : 'off';
  if (f.type === 'enum') return f.options?.find((o) => o.value === raw)?.label ?? raw;
  if (f.type === 'list') return parseList(raw).join(', ') || '(none)';
  if (f.type === 'text') return raw.trim() ? `"${raw.trim()}"` : '(empty)';
  return f.unit ? `${raw} ${f.unit}` : raw;
}

/* ───────────── page ───────────── */

export function SettingsConfigPage({ title, configKey, description, banner, crossChecks, strongConfirm }: Props) {
  const cfgQ = useAdminQuery<ConfigPayload>(`/admin/config/${configKey}`);
  const metaQ = useAdminQuery<Meta>(`/admin/config/${configKey}/meta`);
  const meta = metaQ.data;

  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [base, setBase] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const uid = useId();

  const apply = useCallback((p: ConfigPayload, m: Meta) => {
    const next = fromServer(m, p.value ?? {});
    setForm(next);
    setSaved(next);
    setVersion(p.version);
    setBase(p.value ?? {});
  }, []);

  useEffect(() => {
    if (cfgQ.data && meta && meta.fields) apply(cfgQ.data, meta);
  }, [cfgQ.data, meta, apply]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const errors = useMemo(() => {
    if (!form || !meta?.fields) return null;
    const field: Record<string, string> = {};
    for (const f of meta.fields) {
      const e = validateField(f, form.values[f.key] ?? '', form.values);
      if (e) field[f.key] = e;
    }
    if (crossChecks && Object.keys(field).length === 0) Object.assign(field, crossChecks(form.values));
    const table = meta.surgeTable ? validateTable(meta, form, form.values.maxMultiplier ?? '') : null;
    const count = Object.keys(field).length + (table ? Object.keys(table.rows).length + (table._ ? 1 : 0) : 0);
    return { field, table, count };
  }, [form, meta, crossChecks]);

  const strong = Boolean(form && saved && strongConfirm?.when(saved.values, form.values));

  const confirmBody = useMemo(() => {
    if (!form || !saved || !meta?.fields) return '';
    const warn: string[] = [];
    const lines: string[] = [];
    for (const f of meta.fields) {
      const a = form.values[f.key];
      const b = saved.values[f.key];
      if (a === b) continue;
      lines.push(`${f.label}: ${show(f, b)}  →  ${show(f, a)}`);
      if (f.risk) warn.push(`⚠ ${f.label} — ${RISK_LABEL[f.risk]}.`);
      if (f.restart) warn.push(`ℹ ${f.label} only applies after a backend restart.`);
    }
    if (meta.surgeTable && JSON.stringify(form.table) !== JSON.stringify(saved.table)) {
      const fmt = (t: Form['table']) => t.map((r) => `≥${r.minRatio}→×${r.multiplier}`).join(', ');
      lines.push(`Surge table: ${fmt(saved.table)}  →  ${fmt(form.table)}`);
      warn.push('⚠ Surge table — Affects fares.');
    }
    const head = [...new Set(warn)];
    if (strongConfirm?.when(saved.values, form.values)) head.unshift(`🛑 ${strongConfirm.note}`);
    return [
      'Changes apply to live traffic within about a minute.',
      '',
      ...head,
      ...(head.length ? [''] : []),
      ...(lines.length ? lines : ['No visible changes.']),
    ].join('\n');
  }, [form, saved, meta, strongConfirm]);

  if (cfgQ.error || metaQ.error || (meta && !meta.fields)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {cfgQ.error ?? metaQ.error ?? 'Settings catalog is unavailable.'}
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-5 py-2.5 text-sm"
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
  if (!form || !saved || !meta?.fields || !errors) {
    return (
      <div className="mx-auto max-w-3xl space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const groups = [...new Set(meta.fields.map((f) => f.group))];
  const setVal = (key: string, v: string) => {
    setMsg(null);
    setForm((s) => (s ? { ...s, values: { ...s.values, [key]: v } } : s));
  };
  const setTable = (t: Form['table']) => {
    setMsg(null);
    setForm((s) => (s ? { ...s, table: t } : s));
  };

  function onSave() {
    setErr(null);
    setMsg(null);
    setTouched(true);
    if (errors!.count > 0) {
      setErr(`Fix ${errors!.count} highlighted issue${errors!.count > 1 ? 's' : ''} before saving.`);
      return;
    }
    if (dirty) setConfirmOpen(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      // The PATCH endpoint has no version check, so detect a concurrent save here.
      const latest = await adminFetch<ConfigPayload>(`/admin/config/${configKey}`);
      if (version !== null && latest.version !== version) {
        apply(latest, meta!);
        setErr(`Someone else saved this config (now version ${latest.version}). Their changes were loaded — review and save again.`);
        return;
      }
      const next = await adminFetch<ConfigPayload>(`/admin/config/${configKey}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: toServer(meta!, form!, base) }),
      });
      apply(next, meta!);
      setTouched(false);
      setMsg(`Saved · version ${next.version}. Live within about a minute.`);
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

  const changedCount =
    meta.fields.filter((f) => form.values[f.key] !== saved.values[f.key]).length +
    (JSON.stringify(form.table) !== JSON.stringify(saved.table) ? 1 : 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
        <p className="text-xs text-slate-400">Current version: {version}</p>
      </div>

      {banner ? <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{banner}</div> : null}
      {err ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {err}
        </div>
      ) : null}
      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}

      {groups.map((g) => (
        <Card key={g} title={g}>
          <ul className="divide-y divide-slate-100">
            {meta.fields
              .filter((f) => f.group === g)
              .map((f) => {
                const raw = form.values[f.key] ?? '';
                const fe = touched ? errors.field[f.key] : undefined;
                const modified = raw !== String(f.default);
                const changed = raw !== saved.values[f.key];
                const fid = `${uid}-${f.key}`;
                const wide = f.type === 'list' || (f.type === 'text' && ((f.maxLength ?? 0) > 20 || f.multiline));
                return (
                  <li key={f.key} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={fid} className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                          {f.label}
                          {f.risk ? (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${RISK_CLASS[f.risk]}`}>
                              {RISK_LABEL[f.risk]}
                            </span>
                          ) : null}
                          {f.restart ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              Needs restart
                            </span>
                          ) : null}
                          {changed ? <span className="text-[11px] text-amber-600">edited</span> : null}
                        </label>
                        <p className="mt-0.5 text-xs text-slate-500">{f.description}</p>
                        {f.type === 'int' || f.type === 'number' ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Allowed {f.min}–{f.max}
                            {f.unit ? ` ${f.unit}` : ''} · default {String(f.default)}
                          </p>
                        ) : null}
                      </div>

                      {wide ? null : (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {f.type === 'boolean' ? (
                          <Toggle
                            checked={raw === 'true'}
                            label={f.label}
                            onChange={(v) => setVal(f.key, v ? 'true' : 'false')}
                          />
                        ) : f.type === 'enum' ? (
                          <select
                            id={fid}
                            className={`${inputCls(!!fe)} w-40`}
                            value={raw}
                            onChange={(e) => setVal(f.key, e.target.value)}
                          >
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.type === 'text' ? (
                          <input
                            id={fid}
                            className={`${inputCls(!!fe)} w-40`}
                            value={raw}
                            maxLength={f.maxLength}
                            placeholder={f.placeholder}
                            autoComplete="off"
                            onChange={(e) => setVal(f.key, e.target.value)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              id={fid}
                              inputMode="decimal"
                              className={`${inputCls(!!fe)} w-28 text-right`}
                              value={raw}
                              onChange={(e) => setVal(f.key, e.target.value.replace(/[^\d.]/g, ''))}
                            />
                            {f.unit ? <span className="w-10 text-xs text-slate-500">{f.unit}</span> : null}
                          </div>
                        )}
                        {modified ? (
                          <button
                            type="button"
                            className="text-[11px] text-violet-600 hover:underline"
                            onClick={() => setVal(f.key, String(f.default))}
                          >
                            Reset to default
                          </button>
                        ) : null}
                      </div>
                      )}
                    </div>
                    {wide ? (
                      <div className="mt-2">
                        {f.type === 'list' ? (
                          <ListEditor
                            spec={f}
                            id={fid}
                            items={parseList(raw)}
                            bad={!!fe}
                            onChange={(items) => setVal(f.key, JSON.stringify(items))}
                          />
                        ) : f.multiline ? (
                          <textarea
                            id={fid}
                            rows={3}
                            className={inputCls(!!fe)}
                            value={raw}
                            maxLength={f.maxLength}
                            placeholder={f.placeholder}
                            onChange={(e) => setVal(f.key, e.target.value)}
                          />
                        ) : (
                          <input
                            id={fid}
                            className={inputCls(!!fe)}
                            value={raw}
                            maxLength={f.maxLength}
                            placeholder={f.placeholder}
                            autoComplete="off"
                            inputMode={f.format === 'https-url' ? 'url' : undefined}
                            onChange={(e) => setVal(f.key, e.target.value)}
                          />
                        )}
                        {f.type !== 'list' && f.maxLength ? (
                          <p className="mt-0.5 text-right text-[11px] text-slate-400">
                            {raw.length}/{f.maxLength}
                          </p>
                        ) : null}
                        {modified ? (
                          <button
                            type="button"
                            className="text-[11px] text-violet-600 hover:underline"
                            onClick={() => setVal(f.key, String(f.default))}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {fe ? (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        {fe}
                      </p>
                    ) : null}
                  </li>
                );
              })}
          </ul>

          {g === 'Heatmap' && meta.surgeTable && errors.table ? (
            <SurgeTable
              meta={meta}
              rows={form.table}
              errors={touched ? errors.table : { rows: {} }}
              onChange={setTable}
            />
          ) : null}
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSave}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={discard}
          className="rounded-full border border-slate-200 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          Discard
        </button>
        {dirty ? <span className="text-xs text-amber-600">{changedCount} unsaved change{changedCount === 1 ? '' : 's'}</span> : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Confirm ${title} change`}
        body={confirmBody}
        confirmLabel={saving ? 'Saving…' : 'Save changes'}
        requireText={strong ? strongConfirm?.phrase : undefined}
        danger={strong}
        onCancel={() => !saving && setConfirmOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}

/* ───────────── surge table editor ───────────── */

function SurgeTable({
  meta,
  rows,
  errors,
  onChange,
}: {
  meta: Meta;
  rows: Form['table'];
  errors: TableErrors;
  onChange: (t: Form['table']) => void;
}) {
  const lim = meta.surgeTable!;
  const set = (i: number, p: Partial<Form['table'][number]>) =>
    onChange(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const num = (v: string) => v.replace(/[^\d.]/g, '');
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Surge table</p>
        <button
          type="button"
          disabled={rows.length >= lim.maxRows}
          onClick={() => {
            const last = rows[rows.length - 1];
            onChange([
              ...rows,
              {
                minRatio: String(Math.round(((Number(last?.minRatio) || 0) + 1) * 100) / 100),
                multiplier: last?.multiplier ?? '1',
              },
            ]);
          }}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
        >
          + Add row
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Demand ÷ supply ratio at or above a row's threshold applies that multiplier. First row must be 0; ratios increase
        and multipliers never decrease.
      </p>
      {errors._ ? <p className="mb-2 text-xs text-red-600" role="alert">{errors._}</p> : null}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const e = errors.rows[i];
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-16">Ratio ≥</span>
                  <input
                    aria-label={`Row ${i + 1} minimum ratio`}
                    inputMode="decimal"
                    className={inputCls(!!e?.minRatio)}
                    value={r.minRatio}
                    onChange={(ev) => set(i, { minRatio: num(ev.target.value) })}
                  />
                </div>
                {e?.minRatio ? <p className="mt-0.5 text-[11px] text-red-600">{e.minRatio}</p> : null}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-12">Fare ×</span>
                  <input
                    aria-label={`Row ${i + 1} multiplier`}
                    inputMode="decimal"
                    className={inputCls(!!e?.multiplier)}
                    value={r.multiplier}
                    onChange={(ev) => set(i, { multiplier: num(ev.target.value) })}
                  />
                </div>
                {e?.multiplier ? <p className="mt-0.5 text-[11px] text-red-600">{e.multiplier}</p> : null}
              </div>
              <button
                type="button"
                disabled={rows.length <= 1}
                aria-label={`Remove row ${i + 1}`}
                onClick={() => onChange(rows.filter((_, k) => k !== i))}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-red-600 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── string list editor ───────────── */

function ListEditor({
  spec,
  id,
  items,
  bad,
  onChange,
}: {
  spec: FieldSpec;
  id: string;
  items: string[];
  bad: boolean;
  onChange: (items: string[]) => void;
}) {
  const full = spec.maxItems !== undefined && items.length >= spec.maxItems;
  return (
    <div className="space-y-2" id={id}>
      {items.length === 0 ? <p className="text-xs text-slate-400">None configured.</p> : null}
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            aria-label={`${spec.label} ${i + 1}`}
            className={`${inputCls(bad && (!it.trim() || (spec.pattern ? !new RegExp(spec.pattern).test(it.trim()) : false)))} max-w-[220px]`}
            value={it}
            maxLength={spec.maxLength}
            inputMode="tel"
            placeholder={spec.placeholder}
            autoComplete="off"
            onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
          />
          <button
            type="button"
            aria-label={`Remove ${spec.label} ${i + 1}`}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-red-600"
            onClick={() => onChange(items.filter((_, k) => k !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={full}
        onClick={() => onChange([...items, ''])}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
      >
        + Add{spec.maxItems ? ` (${items.length}/${spec.maxItems})` : ''}
      </button>
    </div>
  );
}
