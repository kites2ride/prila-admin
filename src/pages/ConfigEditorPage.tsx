import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';

type ConfigKey =
  | 'app_config_customer'
  | 'app_config_pilot'
  | 'matching'
  | 'dispatch'
  | 'surge'
  | 'pilot_quality'
  | 'home_promo'
  | 'support'
  | 'maintenance'
  | 'app_update';

type Props = {
  title: string;
  configKey: ConfigKey;
  requireConfirm?: boolean;
  description?: string;
};

type ConfigPayload = { key: string; version: number; value: unknown };

export function ConfigEditorPage({ title, configKey, requireConfirm, description }: Props) {
  const { data, error, loading, reload } = useAdminQuery<ConfigPayload>(`/admin/config/${configKey}`);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(JSON.stringify(data.value, null, 2));
  }, [data]);

  const parsedOk = useMemo(() => {
    try {
      JSON.parse(draft);
      return true;
    } catch {
      return false;
    }
  }, [draft]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const value = JSON.parse(draft) as unknown;
      const next = await adminFetch<ConfigPayload>(`/admin/config/${configKey}`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      setDraft(JSON.stringify(next.value, null, 2));
      setMsg(`Saved · version ${next.version}`);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  function onSaveClick() {
    if (!parsedOk) {
      setErr('JSON is invalid');
      return;
    }
    if (requireConfirm) setConfirmOpen(true);
    else void save();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        {data ? <p className="text-xs text-slate-400">Current version: {data.version}</p> : null}
      </div>
      {error || err ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error ?? err}</div>
      ) : null}
      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}
      {loading && !data ? <div className="text-sm text-slate-500">Loading…</div> : null}
      <textarea
        className="min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving || !parsedOk}
          onClick={onSaveClick}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="rounded-full border border-slate-200 px-5 py-2.5 text-sm" onClick={reload}>
          Reset
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm config change"
        body={`You are about to update ${configKey}. Money and matching changes affect live rides.\n\n${draft.slice(0, 600)}${draft.length > 600 ? '…' : ''}`}
        confirmLabel="Save changes"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}
