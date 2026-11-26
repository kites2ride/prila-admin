import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Card, Field, inputCls } from '../components/formKit';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { MsgToast } from '../components/Toaster';
import { SaveButton } from '../components/SaveButton';

type AppKey = 'customer' | 'pilot';
type Platform = 'android' | 'ios';
type Slot = { minBuild: number; latestBuild: number; storeUrl: string };
type ConfigValue = Record<AppKey, Record<Platform, Slot>>;
type ConfigPayload = { key: string; version: number; value: Partial<ConfigValue> };
type Meta = { appUpdate: { build: { min: number; max: number }; storeHosts: string[] } };

/** Text form state: builds as strings so the field can be empty while typing. */
type SlotForm = { minBuild: string; latestBuild: string; storeUrl: string };
type Form = Record<AppKey, Record<Platform, SlotForm>>;
type SlotErrors = Partial<Record<keyof SlotForm, string>>;

const APPS: AppKey[] = ['customer', 'pilot'];
const PLATFORMS: Platform[] = ['android', 'ios'];
const APP_LABEL: Record<AppKey, string> = { customer: 'Customer app', pilot: 'Pilot app' };
const PLATFORM_LABEL: Record<Platform, string> = { android: 'Android', ios: 'iOS' };

const slotFrom = (s?: Partial<Slot>): SlotForm => ({
  minBuild: String(s?.minBuild ?? 0),
  latestBuild: String(s?.latestBuild ?? 0),
  storeUrl: s?.storeUrl ?? '',
});

function fromServer(v: Partial<ConfigValue>): Form {
  return {
    customer: { android: slotFrom(v.customer?.android), ios: slotFrom(v.customer?.ios) },
    pilot: { android: slotFrom(v.pilot?.android), ios: slotFrom(v.pilot?.ios) },
  };
}

function toServer(f: Form): ConfigValue {
  const one = (s: SlotForm): Slot => ({
    minBuild: Number(s.minBuild),
    latestBuild: Number(s.latestBuild),
    storeUrl: s.storeUrl.trim(),
  });
  return {
    customer: { android: one(f.customer.android), ios: one(f.customer.ios) },
    pilot: { android: one(f.pilot.android), ios: one(f.pilot.ios) },
  };
}

const isWhole = (s: string) => /^\d+$/.test(s.trim());

function validateSlot(s: SlotForm, m: Meta['appUpdate']): SlotErrors {
  const e: SlotErrors = {};
  const { min, max } = m.build;
  if (!isWhole(s.minBuild) || Number(s.minBuild) < min || Number(s.minBuild) > max) e.minBuild = `Whole number ${min}–${max}`;
  if (!isWhole(s.latestBuild) || Number(s.latestBuild) < min || Number(s.latestBuild) > max) {
    e.latestBuild = `Whole number ${min}–${max}`;
  }
  if (!e.minBuild && !e.latestBuild && Number(s.latestBuild) < Number(s.minBuild)) {
    e.latestBuild = 'Cannot be lower than the minimum build';
  }
  const url = s.storeUrl.trim();
  if (url) {
    let ok = false;
    try {
      const u = new URL(url);
      ok = u.protocol === 'https:' && !u.username && !u.password && m.storeHosts.includes(u.hostname);
    } catch {
      ok = false;
    }
    if (!ok) e.storeUrl = `Must be an https:// link on ${m.storeHosts.join(', ')}`;
  } else if (!e.minBuild && Number(s.minBuild) > 0) {
    e.storeUrl = 'Required — users are sent here when forced to update';
  }
  return e;
}

function effect(s: SlotForm): string {
  if (!isWhole(s.minBuild) || !isWhole(s.latestBuild)) return '';
  const min = Number(s.minBuild);
  const latest = Number(s.latestBuild);
  const parts: string[] = [];
  parts.push(min > 0 ? `Builds below ${min} are BLOCKED until they update.` : 'No forced update.');
  parts.push(latest > 0 ? `Builds below ${latest} see an optional update prompt.` : 'No update prompt.');
  return parts.join(' ');
}

export function AppUpdatePage() {
  const cfgQ = useAdminQuery<ConfigPayload>('/admin/config/app_update');
  const metaQ = useAdminQuery<Meta>('/admin/config/app_update/meta');
  const meta = metaQ.data?.appUpdate;

  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const uid = useId();

  const apply = useCallback((p: ConfigPayload) => {
    const next = fromServer(p.value ?? {});
    setForm(next);
    setSaved(next);
    setVersion(p.version);
  }, []);

  useEffect(() => {
    if (cfgQ.data) apply(cfgQ.data);
  }, [cfgQ.data, apply]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const errors = useMemo(() => {
    if (!form || !meta) return null;
    const out = {} as Record<AppKey, Record<Platform, SlotErrors>>;
    let count = 0;
    for (const a of APPS) {
      out[a] = {} as Record<Platform, SlotErrors>;
      for (const p of PLATFORMS) {
        const e = validateSlot(form[a][p], meta);
        out[a][p] = e;
        count += Object.keys(e).length;
      }
    }
    return { slots: out, count };
  }, [form, meta]);

  /** Slots where a (higher) forced-update floor is being introduced. */
  const forcing = useMemo(() => {
    if (!form || !saved) return [] as string[];
    const out: string[] = [];
    for (const a of APPS) {
      for (const p of PLATFORMS) {
        const before = Number(saved[a][p].minBuild);
        const after = Number(form[a][p].minBuild);
        if (Number.isFinite(after) && after > before) out.push(`${APP_LABEL[a]} · ${PLATFORM_LABEL[p]}: builds below ${after}`);
      }
    }
    return out;
  }, [form, saved]);

  const confirmBody = useMemo(() => {
    if (!form || !saved) return '';
    const lines: string[] = [];
    for (const a of APPS) {
      for (const p of PLATFORMS) {
        const b = saved[a][p];
        const n = form[a][p];
        const name = `${APP_LABEL[a]} · ${PLATFORM_LABEL[p]}`;
        if (b.minBuild !== n.minBuild) lines.push(`${name} minimum build: ${b.minBuild}  →  ${n.minBuild}`);
        if (b.latestBuild !== n.latestBuild) lines.push(`${name} latest build: ${b.latestBuild}  →  ${n.latestBuild}`);
        if (b.storeUrl.trim() !== n.storeUrl.trim()) lines.push(`${name} store link: ${b.storeUrl || '(none)'}  →  ${n.storeUrl.trim() || '(none)'}`);
      }
    }
    const head = forcing.length
      ? [
          '🛑 This FORCES an update. These users cannot use the app until they install a newer build:',
          ...forcing.map((x) => `   • ${x}`),
          'Make sure that build is already published and approved in the store.',
          '',
        ]
      : [];
    return [...head, ...(lines.length ? lines : ['No visible changes.'])].join('\n');
  }, [form, saved, forcing]);

  if (cfgQ.error || metaQ.error) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">App update policy</h1>
        <div className="alert alert-danger">{cfgQ.error ?? metaQ.error}</div>
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
  if (!form || !saved || !meta || !errors) {
    return (
      <div className="mx-auto max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">App update policy</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  const patch = (a: AppKey, p: Platform, v: Partial<SlotForm>) => {
    setMsg(null);
    setForm((s) => (s ? { ...s, [a]: { ...s[a], [p]: { ...s[a][p], ...v } } } : s));
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
      const latest = await adminFetch<ConfigPayload>('/admin/config/app_update');
      if (version !== null && latest.version !== version) {
        apply(latest);
        setErr(`Someone else saved this config (now version ${latest.version}). Their changes were loaded — review and save again.`);
        return;
      }
      const next = await adminFetch<ConfigPayload>('/admin/config/app_update', {
        method: 'PATCH',
        body: JSON.stringify({ value: toServer(form!) }),
      });
      apply(next);
      setTouched(false);
      setMsg(`Saved · version ${next.version}. Apps see this on their next launch (within about a minute).`);
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

  const num = (v: string) => v.replace(/[^\d]/g, '');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">App update policy</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Control which app builds may keep running. Build numbers are the integer build (versionCode / CFBundleVersion),
          not the version name.
        </p>
        <p className="text-xs text-slate-400">Current version: {version}</p>
      </div>

      <div className="alert alert-warn">
        <b>Minimum build</b> forces an update — older installs are locked out until they update. <b>Latest build</b> only
        shows an optional prompt. Set 0 to turn a rule off. Never set a build that is not yet live in the store.
      </div>

      {err ? (
        <div className="alert alert-danger" role="alert">
          {err}
        </div>
      ) : null}
      <MsgToast msg={msg} />

      {APPS.map((a) => (
        <Card key={a} title={APP_LABEL[a]}>
          <div className="grid gap-4 md:grid-cols-2">
            {PLATFORMS.map((p) => {
              const s = form[a][p];
              const e = touched ? errors.slots[a][p] : {};
              const id = (n: string) => `${uid}-${a}-${p}-${n}`;
              const fx = effect(s);
              const forced = isWhole(s.minBuild) && Number(s.minBuild) > 0;
              return (
                <div key={p} className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {PLATFORM_LABEL[p]}
                    {forced ? (
                      <span className="badge badge-danger">
                        Forced update active
                      </span>
                    ) : null}
                  </p>
                  <Field label="Minimum build (forced)" htmlFor={id('min')} error={e.minBuild}>
                    <input
                      id={id('min')}
                      inputMode="numeric"
                      className={inputCls(!!e.minBuild)}
                      value={s.minBuild}
                      onChange={(ev) => patch(a, p, { minBuild: num(ev.target.value) })}
                    />
                  </Field>
                  <Field label="Latest build (optional prompt)" htmlFor={id('latest')} error={e.latestBuild}>
                    <input
                      id={id('latest')}
                      inputMode="numeric"
                      className={inputCls(!!e.latestBuild)}
                      value={s.latestBuild}
                      onChange={(ev) => patch(a, p, { latestBuild: num(ev.target.value) })}
                    />
                  </Field>
                  <Field
                    label="Store link"
                    htmlFor={id('url')}
                    error={e.storeUrl}
                    hint={p === 'android' ? 'https://play.google.com/store/apps/details?id=…' : 'https://apps.apple.com/app/…'}
                  >
                    <input
                      id={id('url')}
                      inputMode="url"
                      autoComplete="off"
                      className={inputCls(!!e.storeUrl)}
                      value={s.storeUrl}
                      maxLength={2048}
                      onChange={(ev) => patch(a, p, { storeUrl: ev.target.value })}
                    />
                  </Field>
                  {fx ? <p className="text-xs text-slate-500">{fx}</p> : null}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton saving={saving} failed={Boolean(err)} disabled={!dirty} onClick={onSave} />
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
        title="Confirm app update policy"
        body={confirmBody}
        confirmLabel={saving ? 'Saving…' : 'Save changes'}
        requireText={forcing.length ? 'FORCE UPDATE' : undefined}
        danger={forcing.length > 0}
        onCancel={() => !saving && setConfirmOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}
