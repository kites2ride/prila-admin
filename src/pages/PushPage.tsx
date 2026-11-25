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
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Push notification</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Sends via FCM when FIREBASE_SERVICE_ACCOUNT_PATH is set; otherwise returns fcm_disabled.
        </p>
      </div>
      <label className="block text-sm">
        Title
        <input className="field mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm">
        Body
        <textarea className="field mt-1 w-full" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="block text-sm">
        Topic
        <input className="field mt-1 w-full" value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>
      <label className="block text-sm">
        Deep link (optional)
        <input className="field mt-1 w-full" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={busy || !title || !body}
        className="btn btn-primary"
        onClick={() => void send()}
      >
        {busy ? 'Sending…' : 'Send'}
      </button>
      {result ? <pre className="overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-green-300">{result}</pre> : null}
    </div>
  );
}
