import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Card, Field, Toggle, inputCls } from '../components/formKit';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';

/* ───────────── types (mirror backend homePromoValueSchema) ───────────── */

type Frequency = 'every_open' | 'daily' | 'weekly' | 'once';
type Audience = 'all' | 'new' | 'city';
type AppKey = 'customer' | 'pilot';

type PromoSlot = {
  enabled: boolean;
  campaignId?: string;
  imageUrl?: string;
  title?: string;
  body?: string;
  cta?: string;
  deepLink?: string;
  frequency: Frequency;
  audience: Audience;
  cityIds?: string[];
  startsAt?: string;
  endsAt?: string;
};
type PromoValue = Record<AppKey, PromoSlot>;
type ConfigPayload = { key: string; version: number; value: Partial<PromoValue> };
type City = { id: string; name: string };

/** Form state: every text field is a string ('' = not set). Schedule is IST wall-clock `YYYY-MM-DDTHH:mm`. */
type Form = {
  enabled: boolean;
  campaignId: string;
  imageUrl: string;
  title: string;
  body: string;
  cta: string;
  deepLink: string;
  frequency: Frequency;
  audience: Audience;
  cityIds: string[];
  startsAt: string;
  endsAt: string;
};
type FormState = Record<AppKey, Form>;
type Errors = Partial<Record<keyof Form, string>>;

const LIMITS = { title: 60, body: 140, cta: 24, campaignId: 40, url: 2048 } as const;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const FREQUENCY_LABEL: Record<Frequency, string> = {
  every_open: 'Every app open',
  daily: 'Once a day',
  weekly: 'Once a week',
  once: 'Once per user',
};
const AUDIENCE_LABEL: Record<Audience, string> = {
  all: 'Everyone',
  new: 'New users only',
  city: 'Selected cities',
};

/* ───────────── helpers ───────────── */

const emptyForm: Form = {
  enabled: false,
  campaignId: '',
  imageUrl: '',
  title: '',
  body: '',
  cta: '',
  deepLink: '',
  frequency: 'once',
  audience: 'all',
  cityIds: [],
  startsAt: '',
  endsAt: '',
};

function isoToIstLocal(iso?: string): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 16);
}

function istLocalToIso(local: string): string | undefined {
  if (!local) return undefined;
  const ms = Date.parse(`${local}:00+05:30`);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function fromServer(slot?: Partial<PromoSlot>): Form {
  return {
    enabled: slot?.enabled === true,
    campaignId: slot?.campaignId ?? '',
    imageUrl: slot?.imageUrl ?? '',
    title: slot?.title ?? '',
    body: slot?.body ?? '',
    cta: slot?.cta ?? '',
    deepLink: slot?.deepLink ?? '',
    frequency: slot?.frequency ?? 'once',
    audience: slot?.audience ?? 'all',
    cityIds: slot?.cityIds ?? [],
    startsAt: isoToIstLocal(slot?.startsAt),
    endsAt: isoToIstLocal(slot?.endsAt),
  };
}

function toServer(f: Form): PromoSlot {
  const t = (v: string) => v.trim() || undefined;
  return {
    enabled: f.enabled,
    campaignId: t(f.campaignId),
    imageUrl: t(f.imageUrl),
    title: t(f.title),
    body: t(f.body),
    cta: t(f.cta),
    deepLink: t(f.deepLink),
    frequency: f.frequency,
    audience: f.audience,
    cityIds: f.audience === 'city' ? f.cityIds : undefined,
    startsAt: istLocalToIso(f.startsAt),
    endsAt: istLocalToIso(f.endsAt),
  };
}

function isHttps(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

function isDeepLink(v: string): boolean {
  return /^prila:\/\/[a-z0-9][a-z0-9/_?=&.-]*$/i.test(v) || isHttps(v);
}

/** Mirrors the backend rules so the admin sees problems before saving. Backend remains the authority. */
function validate(f: Form): Errors {
  const e: Errors = {};
  const title = f.title.trim();
  const cta = f.cta.trim();
  const image = f.imageUrl.trim();
  const link = f.deepLink.trim();
  const campaign = f.campaignId.trim();

  if (title.length > LIMITS.title) e.title = `Max ${LIMITS.title} characters`;
  if (f.body.trim().length > LIMITS.body) e.body = `Max ${LIMITS.body} characters`;
  if (cta.length > LIMITS.cta) e.cta = `Max ${LIMITS.cta} characters`;
  if (image && (image.length > LIMITS.url || !isHttps(image))) e.imageUrl = 'Must be a valid https:// URL';
  if (link && (link.length > LIMITS.url || !isDeepLink(link))) e.deepLink = 'Use prila://<route> or an https:// URL';
  if (campaign && !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(campaign)) {
    e.campaignId = 'Lowercase letters, digits, - or _ (max 40)';
  }
  if (f.enabled) {
    if (!title && !image) e.title = 'A live promo needs a title or an image';
    if (cta && !link) e.deepLink = 'A button needs a link';
    if (f.frequency === 'once' && !campaign) {
      e.campaignId = 'Required so "Once per user" can be tracked — change it for every new campaign';
    }
  }
  if (f.audience === 'city' && f.cityIds.length === 0) e.cityIds = 'Pick at least one city';
  if (f.startsAt && f.endsAt && Date.parse(`${f.endsAt}:00+05:30`) <= Date.parse(`${f.startsAt}:00+05:30`)) {
    e.endsAt = 'End must be after start';
  }
  return e;
}

function describe(f: Form, cities: City[]): Record<string, string> {
  const cityNames = f.cityIds.map((id) => cities.find((c) => c.id === id)?.name ?? id).join(', ');
  return {
    Status: f.enabled ? 'LIVE' : 'Off',
    Title: f.title.trim() || '—',
    Message: f.body.trim() || '—',
    'Button text': f.cta.trim() || '—',
    Link: f.deepLink.trim() || '—',
    Image: f.imageUrl.trim() || '—',
    'Campaign ID': f.campaignId.trim() || '—',
    Frequency: FREQUENCY_LABEL[f.frequency],
    Audience: f.audience === 'city' ? `${AUDIENCE_LABEL.city}: ${cityNames || '—'}` : AUDIENCE_LABEL[f.audience],
    Starts: f.startsAt ? `${f.startsAt.replace('T', ' ')} IST` : 'Immediately',
    Ends: f.endsAt ? `${f.endsAt.replace('T', ' ')} IST` : 'No end',
  };
}

function diffLines(app: AppKey, before: Form, after: Form, cities: City[]): string[] {
  const b = describe(before, cities);
  const a = describe(after, cities);
  return Object.keys(a)
    .filter((k) => a[k] !== b[k])
    .map((k) => `${app}.${k}: ${b[k]}  →  ${a[k]}`);
}

/* ───────────── small UI pieces ───────────── */

function PromoPreview({ form, app }: { form: Form; app: AppKey }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = form.imageUrl.trim();
  useEffect(() => setImgFailed(false), [url]);
  const showImg = url !== '' && isHttps(url) && !imgFailed;
  const title = form.title.trim();
  const body = form.body.trim();
  const cta = form.cta.trim();
  const empty = !title && !body && !showImg;

  return (
    <div>
      <div className="mx-auto w-full max-w-[320px] rounded-[28px] border-4 border-slate-800 bg-slate-100 p-3 shadow-lg">
        <p className="mb-2 text-center text-[11px] font-medium text-slate-400">
          {app === 'customer' ? 'Customer' : 'Pilot'} app · Home
        </p>
        {empty ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
            Add a title, message or image to see the preview.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {showImg ? (
              <img
                src={url}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setImgFailed(true)}
                className="h-32 w-full object-cover"
              />
            ) : null}
            <div className="space-y-1 p-3">
              {title ? <p className="text-sm font-bold text-slate-900 break-words">{title}</p> : null}
              {body ? <p className="text-xs text-slate-600 break-words">{body}</p> : null}
              {cta ? (
                <span className="mt-2 inline-block rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">
                  {cta}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {url !== '' && !isHttps(url) ? (
        <p className="mt-2 text-center text-xs text-red-600">Image ignored: must be https://</p>
      ) : imgFailed ? (
        <p className="mt-2 text-center text-xs text-amber-600">Image could not be loaded from this URL.</p>
      ) : null}
      <p className="mt-2 text-center text-xs text-slate-400">Approximate preview. Final layout is rendered by the app.</p>
    </div>
  );
}

/* ───────────── page ───────────── */

export function HomePromoPage() {
  const { data, error, loading, reload } = useAdminQuery<ConfigPayload>('/admin/config/home_promo');
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const cities = useMemo(() => citiesQ.data?.items ?? [], [citiesQ.data]);

  const [which, setWhich] = useState<AppKey>('customer');
  const [form, setForm] = useState<FormState>({ customer: emptyForm, pilot: emptyForm });
  const [saved, setSaved] = useState<FormState>({ customer: emptyForm, pilot: emptyForm });
  const [version, setVersion] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const uid = useId();

  const applyServer = useCallback((p: ConfigPayload) => {
    const next = { customer: fromServer(p.value?.customer), pilot: fromServer(p.value?.pilot) };
    setForm(next);
    setSaved(next);
    setVersion(p.version);
  }, []);

  useEffect(() => {
    if (data) applyServer(data);
  }, [data, applyServer]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const dirtyApps = (['customer', 'pilot'] as AppKey[]).filter(
    (a) => JSON.stringify(form[a]) !== JSON.stringify(saved[a]),
  );
  const errors = useMemo(
    () => ({ customer: validate(form.customer), pilot: validate(form.pilot) }),
    [form],
  );
  const errorCount = (a: AppKey) => Object.keys(errors[a]).length;
  const totalErrors = errorCount('customer') + errorCount('pilot');

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  function patch(p: Partial<Form>) {
    setMsg(null);
    setForm((s) => ({ ...s, [which]: { ...s[which], ...p } }));
  }

  const f = form[which];
  const e = touched ? errors[which] : {};
  const id = (n: string) => `${uid}-${which}-${n}`;

  function onSaveClick() {
    setErr(null);
    setMsg(null);
    setTouched(true);
    if (totalErrors > 0) {
      setErr(`Fix ${totalErrors} highlighted issue${totalErrors > 1 ? 's' : ''} before saving.`);
      return;
    }
    if (!dirty) return;
    setConfirmOpen(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      // Guard against a colleague saving in the meantime (no server-side version check on PATCH).
      const latest = await adminFetch<ConfigPayload>('/admin/config/home_promo');
      if (version !== null && latest.version !== version) {
        applyServer(latest);
        setErr(
          `Someone else saved this config (now version ${latest.version}). Their changes were loaded — review and save again.`,
        );
        return;
      }
      const next = await adminFetch<ConfigPayload>('/admin/config/home_promo', {
        method: 'PATCH',
        body: JSON.stringify({ value: { customer: toServer(form.customer), pilot: toServer(form.pilot) } }),
      });
      applyServer(next);
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

  const confirmBody = useMemo(() => {
    const lines = dirtyApps.flatMap((a) => diffLines(a, saved[a], form[a], cities));
    const goingLive = dirtyApps.filter((a) => form[a].enabled && !saved[a].enabled);
    const head = goingLive.length
      ? `⚠ This makes the promo LIVE for ${goingLive.join(' & ')} app users.\n\n`
      : 'Review the changes below.\n\n';
    return head + (lines.join('\n') || 'No visible changes.');
  }, [dirtyApps, saved, form, cities]);

  const cityNote = f.audience === 'city' && cities.length === 0 && !citiesQ.loading;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Home promo</h1>
          <p className="text-sm text-slate-500">
            Banner shown on the app home screen. Apps read it through bootstrap; changes reach users within ~1 minute.
          </p>
          {version !== null ? <p className="text-xs text-slate-400">Current version: {version}</p> : null}
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm" role="tablist">
          {(['customer', 'pilot'] as AppKey[]).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={which === a}
              onClick={() => setWhich(a)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 capitalize ${
                which === a ? 'bg-violet-600 text-white' : 'text-slate-600'
              }`}
            >
              {a}
              {form[a].enabled ? (
                <span className={`h-2 w-2 rounded-full ${which === a ? 'bg-emerald-300' : 'bg-emerald-500'}`} title="Live" />
              ) : null}
              {dirtyApps.includes(a) ? <span className="text-xs" title="Unsaved changes">•</span> : null}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {err ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {err}
        </div>
      ) : null}
      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}
      {loading && !data ? <div className="text-sm text-slate-500">Loading…</div> : null}

      <fieldset disabled={loading && !data} className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card title="Status">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {f.enabled ? 'Live — visible to the audience below' : 'Off — nothing is shown'}
                </p>
                <p className="text-xs text-slate-500">
                  The schedule window below also applies. Outside it, the promo stays hidden even when live.
                </p>
              </div>
              <Toggle checked={f.enabled} onChange={(v) => patch({ enabled: v })} label={`Promo enabled for ${which} app`} />
            </div>
          </Card>

          <Card title="Content">
            <Field label="Title" htmlFor={id('title')} error={e.title} counter={`${f.title.length}/${LIMITS.title}`}>
              <input
                id={id('title')}
                className={inputCls(!!e.title)}
                value={f.title}
                maxLength={LIMITS.title}
                onChange={(ev) => patch({ title: ev.target.value })}
                placeholder="Festival offer: 20% off your next ride"
              />
            </Field>
            <Field label="Message" htmlFor={id('body')} error={e.body} counter={`${f.body.length}/${LIMITS.body}`}>
              <textarea
                id={id('body')}
                rows={2}
                className={inputCls(!!e.body)}
                value={f.body}
                maxLength={LIMITS.body}
                onChange={(ev) => patch({ body: ev.target.value })}
                placeholder="Short supporting text (optional)"
              />
            </Field>
            <Field
              label="Image URL"
              htmlFor={id('image')}
              error={e.imageUrl}
              hint="https:// only. Use a CDN-hosted image, ideally 16:9 and under 200 KB."
            >
              <input
                id={id('image')}
                className={inputCls(!!e.imageUrl)}
                value={f.imageUrl}
                maxLength={LIMITS.url}
                inputMode="url"
                autoComplete="off"
                onChange={(ev) => patch({ imageUrl: ev.target.value })}
                placeholder="https://cdn.prila.in/promos/festival.jpg"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button text" htmlFor={id('cta')} error={e.cta} counter={`${f.cta.length}/${LIMITS.cta}`}>
                <input
                  id={id('cta')}
                  className={inputCls(!!e.cta)}
                  value={f.cta}
                  maxLength={LIMITS.cta}
                  onChange={(ev) => patch({ cta: ev.target.value })}
                  placeholder="Book now"
                />
              </Field>
              <Field
                label="Button link"
                htmlFor={id('link')}
                error={e.deepLink}
                hint="prila://<route> or https://"
              >
                <input
                  id={id('link')}
                  className={inputCls(!!e.deepLink)}
                  value={f.deepLink}
                  maxLength={LIMITS.url}
                  autoComplete="off"
                  onChange={(ev) => patch({ deepLink: ev.target.value })}
                  placeholder="prila://book"
                />
              </Field>
            </div>
          </Card>

          <Card title="Targeting">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Show how often" htmlFor={id('freq')}>
                <select
                  id={id('freq')}
                  className={inputCls()}
                  value={f.frequency}
                  onChange={(ev) => patch({ frequency: ev.target.value as Frequency })}
                >
                  {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((k) => (
                    <option key={k} value={k}>
                      {FREQUENCY_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Audience" htmlFor={id('aud')}>
                <select
                  id={id('aud')}
                  className={inputCls()}
                  value={f.audience}
                  onChange={(ev) => patch({ audience: ev.target.value as Audience })}
                >
                  {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((k) => (
                    <option key={k} value={k}>
                      {AUDIENCE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {f.audience === 'city' ? (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">Cities</p>
                <div
                  className={`flex flex-wrap gap-2 rounded-xl border p-3 ${e.cityIds ? 'border-red-400' : 'border-slate-200'}`}
                >
                  {cities.map((c) => {
                    const on = f.cityIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                          on ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            patch({ cityIds: on ? f.cityIds.filter((x) => x !== c.id) : [...f.cityIds, c.id] })
                          }
                        />
                        {c.name}
                      </label>
                    );
                  })}
                  {citiesQ.loading ? <span className="text-sm text-slate-400">Loading cities…</span> : null}
                  {cityNote ? <span className="text-sm text-slate-400">No cities configured yet.</span> : null}
                </div>
                {e.cityIds ? (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {e.cityIds}
                  </p>
                ) : null}
              </div>
            ) : null}
            {f.audience === 'new' ? (
              <p className="text-xs text-amber-600">
                "New users only" is stored for the apps to apply; the server does not filter it in bootstrap yet.
              </p>
            ) : null}

            <Field
              label="Campaign ID"
              htmlFor={id('camp')}
              error={e.campaignId}
              hint='Identifies this campaign for "once" tracking and analytics. Use a new ID for every new campaign, e.g. diwali-2026.'
            >
              <input
                id={id('camp')}
                className={inputCls(!!e.campaignId)}
                value={f.campaignId}
                maxLength={LIMITS.campaignId}
                autoComplete="off"
                onChange={(ev) => patch({ campaignId: ev.target.value.toLowerCase() })}
                placeholder="diwali-2026"
              />
            </Field>
          </Card>

          <Card title="Schedule (IST)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" htmlFor={id('start')} hint="Empty = immediately">
                <input
                  id={id('start')}
                  type="datetime-local"
                  className={inputCls()}
                  value={f.startsAt}
                  onChange={(ev) => patch({ startsAt: ev.target.value })}
                />
              </Field>
              <Field label="Ends" htmlFor={id('end')} error={e.endsAt} hint="Empty = runs until switched off">
                <input
                  id={id('end')}
                  type="datetime-local"
                  className={inputCls(!!e.endsAt)}
                  value={f.endsAt}
                  onChange={(ev) => patch({ endsAt: ev.target.value })}
                />
              </Field>
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Preview">
            <PromoPreview form={f} app={which} />
          </Card>
        </aside>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSaveClick}
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
        <button
          type="button"
          disabled={saving || dirty}
          onClick={reload}
          title={dirty ? 'Save or discard your changes first' : 'Reload from server'}
          className="rounded-full border border-slate-200 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          Refresh
        </button>
        {dirty ? <span className="text-xs text-amber-600">Unsaved changes</span> : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm promo change"
        body={confirmBody}
        confirmLabel={saving ? 'Saving…' : 'Save changes'}
        onCancel={() => !saving && setConfirmOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}
