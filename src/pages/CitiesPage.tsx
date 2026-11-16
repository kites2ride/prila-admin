import { useState, type FormEvent } from 'react';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';
import { CityPricingCard, type CityPricing } from './CityPricingCard';

type City = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  timezone?: string;
  center: { lng: number; lat: number };
  services: string[];
  pricing: CityPricing;
};

export function CitiesPage() {
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const cityId = selectedCityId || citiesQ.data?.items[0]?.id || '';
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [cityForm, setCityForm] = useState({
    name: '',
    slug: '',
    lat: '17.9689',
    lng: '79.5941',
    services: 'bike,auto,parcel,logistics',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cities</h1>
        <p className="text-sm text-slate-500">
          Draw where Prila operates on the <a className="font-medium text-violet-700 underline" href="#/zones">Zones (map)</a> page.
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
          <h2 className="font-semibold">Zones</h2>
          <p className="mt-2 text-sm text-slate-600">
            Service and blocked zones are drawn and tested on the map, with validation, versioning and audit.
          </p>
          <a
            href="#/zones"
            className="mt-4 inline-block rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white"
          >
            Open Zones (map)
          </a>
        </section>
      </div>

      {(() => {
        const city = citiesQ.data?.items.find((c) => c.id === cityId);
        return city ? (
          <CityPricingCard
            key={city.id}
            city={city}
            onSaved={() => {
              setMsg(`Pricing times saved for ${city.name}`);
              citiesQ.reload();
            }}
          />
        ) : null;
      })()}
    </div>
  );
}
