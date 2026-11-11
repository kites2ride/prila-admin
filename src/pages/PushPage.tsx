import { useState } from 'react';
import { adminFetch } from '../lib/adminFetch';

export function PushPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState('city_warangal');
  const [deepLink, setDeepLink] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const data = await adminFetch<Record<string, unknown>>('/admin/push/send', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          topic: topic || undefined,
          deepLink: deepLink || undefined,
        }),
      });
      setResult(JSON.stringify(data));
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Push notification</h1>
        <p className="mt-1 text-sm text-[var(--prila-muted)]">
          Sends via FCM when FIREBASE_SERVICE_ACCOUNT_PATH is set; otherwise returns fcm_disabled.
        </p>
      </div>
      <label className="block text-sm">
        Title
        <input className="mt-1 w-full rounded-xl border border-[var(--prila-border)] px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm">
        Body
        <textarea className="mt-1 w-full rounded-xl border border-[var(--prila-border)] px-3 py-2" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="block text-sm">
        Topic
        <input className="mt-1 w-full rounded-xl border border-[var(--prila-border)] px-3 py-2" value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>
      <label className="block text-sm">
        Deep link (optional)
        <input className="mt-1 w-full rounded-xl border border-[var(--prila-border)] px-3 py-2" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={busy || !title || !body}
        className="rounded-xl bg-[var(--prila-purple)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() => void send()}
      >
        {busy ? 'Sending…' : 'Send'}
      </button>
      {result ? <pre className="overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-green-300">{result}</pre> : null}
    </div>
  );
}
