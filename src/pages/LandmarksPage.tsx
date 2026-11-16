import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { parseLatLng } from '../lib/polygon';
import { useAdminQuery } from '../lib/useAdminQuery';

type City = { id: string; name: string };
type Landmark = {
  id: string;
  cityId: string | null;
  name: string;
  aliases: string[];
  address: string;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  priority: number;
};
type ListPayload = { items: Landmark[]; total: number; page: number; limit: number };

type Form = { name: string; aliases: string; address: string; latLng: string; priority: string; enabled: boolean };
const EMPTY: Form = { name: '', aliases: '', address: '', latLng: '', priority: '0', enabled: true };

/**
 * Ops-curated places riders search for (bus stand, railway station, hospitals…).
 * Searched before Google, so good coverage here cuts Google cost.
 */
export function LandmarksPage() {
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const [cityId, setCityId] = useState('');
  const activeCityId = cityId || citiesQ.data?.items[0]?.id || '';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const listQ = useAdminQuery<ListPayload>(
    activeCityId
      ? `/admin/landmarks?cityId=${activeCityId}&limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`
      : null,
  );

  const [editingId, setEditingId] = useState<string | null | undefined>(undefined); // null = new
  const [form, setForm] = useState<Form>(EMPTY);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const point = parseLatLng(form.latLng);
  const aliases = form.aliases
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  const priority = Number(form.priority);
  const formError = !form.name.trim()
    ? 'Name is required.'
    : form.name.trim().length > 80
      ? 'Name is too long (max 80).'
      : !point
        ? 'Enter the location as "lat, lng", e.g. 17.9760, 79.5020 (copy from Google Maps).'
        : aliases.length > 10
          ? 'At most 10 other names.'
          : aliases.some((a) => a.length > 60)
            ? 'Each other name must be 60 characters or less.'
            : !Number.isInteger(priority) || priority < -100 || priority > 100
              ? 'Priority must be a whole number between -100 and 100.'
              : null;

  function startEdit(l: Landmark | null) {
    setMsg(null);
    setErr(null);
    setEditingId(l ? l.id : null);
    setForm(
      l
        ? {
            name: l.name,
            aliases: l.aliases.join(', '),
            address: l.address,
            latLng: l.lat != null && l.lng != null ? `${l.lat}, ${l.lng}` : '',
            priority: String(l.priority),
            enabled: l.enabled,
          }
        : EMPTY,
    );
  }

  async function save() {
    if (editingId === undefined || !point) return;
    setConfirmOpen(false);
    setSaving(true);
    setErr(null);
    try {
      const body = {
        cityId: activeCityId || null,
        name: form.name.trim(),
        aliases,
        address: form.address.trim(),
        lat: point.lat,
        lng: point.lng,
        enabled: form.enabled,
        priority,
      };
      await adminFetch(editingId ? `/admin/landmarks/${editingId}` : '/admin/landmarks', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      setMsg(`Landmark "${body.name}" saved.`);
      setEditingId(undefined);
      setForm(EMPTY);
      listQ.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const items = listQ.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Landmarks</h1>
          <p className="text-sm text-slate-500">
            Places riders search for most. These show first in search and are free — Google is only asked when few
            landmarks match.
          </p>
        </div>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={activeCityId}
          onChange={(e) => {
            setCityId(e.target.value);
            setEditingId(undefined);
          }}
        >
          {(citiesQ.data?.items ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}
      {err ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {listQ.error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{listQ.error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(q.trim());
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search name or other name"
                value={q}
                maxLength={80}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                Search
              </button>
            </form>
            <button
              type="button"
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={!activeCityId}
              onClick={() => startEdit(null)}
            >
              + New landmark
            </button>
          </div>

          {listQ.loading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
          {!listQ.loading && items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {query ? 'No landmarks match this search.' : 'No landmarks yet. Add the bus stand, railway station and big hospitals first.'}
            </p>
          ) : null}

          {items.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Other names</th>
                    <th className="py-2 pr-3 font-medium">Address</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                    <th className="py-2 pr-3 font-medium">Priority</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 align-top">
                      <td className="py-2 pr-3 font-medium">{l.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{l.aliases.join(', ') || '—'}</td>
                      <td className="py-2 pr-3 text-slate-600">{l.address || '—'}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-500">
                        {l.lat != null && l.lng != null ? `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : '—'}
                      </td>
                      <td className="py-2 pr-3">{l.priority}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            l.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {l.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50"
                          onClick={() => startEdit(l)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {listQ.data && listQ.data.total > items.length ? (
                <p className="mt-2 text-xs text-slate-500">
                  Showing {items.length} of {listQ.data.total}. Search to narrow down.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {editingId !== undefined ? (
          <section className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4">
            <h2 className="font-semibold">{editingId ? 'Edit landmark' : 'New landmark'}</h2>
            <label className="block text-xs font-medium text-slate-600">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Kazipet Junction"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Other names people type (comma separated)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="KZJ, Railway station"
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Address
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Kazipet, Hanamkonda"
                value={form.address}
                maxLength={200}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Location (lat, lng)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                placeholder="17.9760, 79.5020"
                value={form.latLng}
                onChange={(e) => setForm({ ...form, latLng: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-600">
                Priority
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.priority}
                  min={-100}
                  max={100}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            <p className="text-xs text-slate-500">Higher priority shows first when several landmarks match.</p>
            {formError ? <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{formError}</div> : null}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={Boolean(formError) || saving}
                onClick={() => setConfirmOpen(true)}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  setEditingId(undefined);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={editingId ? 'Save landmark changes?' : 'Create landmark?'}
        body={`${form.name.trim()}${aliases.length ? ` (also: ${aliases.join(', ')})` : ''}\n${
          point ? `${point.lat}, ${point.lng}` : ''
        }\n${form.enabled ? 'Riders will see it in search immediately.' : 'Disabled — riders will not see it.'}\nRecorded in the audit log.`}
        confirmLabel="Save landmark"
        onConfirm={() => void save()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
