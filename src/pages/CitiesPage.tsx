import { useState, type FormEvent } from 'react';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';

type City = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  center: { lng: number; lat: number };
  services: string[];
};

type Zone = {
  id: string;
  cityId: string;
  name: string;
  enabled: boolean;
  coordinates: number[][][];
};

export function CitiesPage() {
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const cityId = selectedCityId || citiesQ.data?.items[0]?.id || '';
  const zonesQ = useAdminQuery<{ items: Zone[] }>(cityId ? `/admin/zones?cityId=${cityId}` : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [cityForm, setCityForm] = useState({
    name: '',
    slug: '',
    lat: '17.9689',
    lng: '79.5941',
    services: 'bike,auto,parcel,logistics',
  });

  const [zoneForm, setZoneForm] = useState({
    name: '',
    coordinates: '',
  });

  async function createCity(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await adminFetch('/admin/cities', {
        method: 'POST',
        body: JSON.stringify({
          name: cityForm.name,
          slug: cityForm.slug,
          enabled: true,
          center: { lat: Number(cityForm.lat), lng: Number(cityForm.lng) },
          services: cityForm.services.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      setMsg('City saved');
      citiesQ.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    }
  }

  async function createZone(e: FormEvent) {
    e.preventDefault();
    if (!cityId) return;
    setErr(null);
    try {
      const coordinates = JSON.parse(zoneForm.coordinates) as number[][][];
      await adminFetch('/admin/zones', {
        method: 'POST',
        body: JSON.stringify({
          cityId,
          name: zoneForm.name,
          enabled: true,
          coordinates,
        }),
      });
      setMsg('Zone saved');
      zonesQ.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed — check GeoJSON ring JSON');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cities & zones</h1>
        <p className="text-sm text-slate-500">
          Polygon editor uses GeoJSON coordinates for now. Google Maps drawing lands when Maps key is set.
        </p>
      </div>
      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}
      {err ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Cities</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(citiesQ.data?.items ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left ${
                    c.id === cityId ? 'bg-violet-50 text-violet-800' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedCityId(c.id)}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.slug} · {c.services.join(', ')}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={createCity} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="text-sm font-medium">Add city</div>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Name"
              value={cityForm.name}
              onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
              required
            />
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="slug"
              value={cityForm.slug}
              onChange={(e) => setCityForm({ ...cityForm, slug: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="lat"
                value={cityForm.lat}
                onChange={(e) => setCityForm({ ...cityForm, lat: e.target.value })}
              />
              <input
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="lng"
                value={cityForm.lng}
                onChange={(e) => setCityForm({ ...cityForm, lng: e.target.value })}
              />
            </div>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="services csv"
              value={cityForm.services}
              onChange={(e) => setCityForm({ ...cityForm, services: e.target.value })}
            />
            <button type="submit" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white">
              Create city
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Zones {cityId ? '' : '(select a city)'}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(zonesQ.data?.items ?? []).map((z) => (
              <li key={z.id} className="rounded-xl border border-slate-100 px-3 py-2">
                <div className="font-medium">{z.name}</div>
                <div className="text-xs text-slate-500">{z.enabled ? 'enabled' : 'disabled'}</div>
              </li>
            ))}
          </ul>
          <form onSubmit={createZone} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="text-sm font-medium">Add zone (GeoJSON ring)</div>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Zone name"
              value={zoneForm.name}
              onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
              required
            />
            <textarea
              className="min-h-32 w-full rounded-lg border px-3 py-2 font-mono text-xs"
              placeholder='[[[lng,lat],[lng,lat],...]]'
              value={zoneForm.coordinates}
              onChange={(e) => setZoneForm({ ...zoneForm, coordinates: e.target.value })}
              required
            />
            <button
              type="submit"
              disabled={!cityId}
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Create zone
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
