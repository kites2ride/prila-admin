import { useEffect, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch } from '../lib/adminFetch';
import { useAdminQuery } from '../lib/useAdminQuery';

type Service = {
  type: string;
  name: string;
  enabled: boolean;
  order: number;
  capacity: number;
  maxWeightKg?: number | null;
  minWeightKg?: number | null;
};

type City = { id: string; name: string };
type Fare = {
  cityId: string;
  serviceType: string;
  version: number;
  baseFarePaise: number;
  perKmPaise: number;
  perMinutePaise: number;
  minimumFarePaise: number;
  nightMultiplier: number;
  surgeMultiplier: number;
  waitingPerMinutePaise: number;
  cancellationFeePaise: number;
  platformFeePaise: number;
};

const emptyFare = {
  baseFarePaise: 2000,
  perKmPaise: 800,
  perMinutePaise: 100,
  minimumFarePaise: 3000,
  nightMultiplier: 1.2,
  surgeMultiplier: 1,
  waitingPerMinutePaise: 100,
  cancellationFeePaise: 2000,
  platformFeePaise: 500,
};

export function ServicesFaresPage() {
  const servicesQ = useAdminQuery<{ items: Service[] }>('/admin/services');
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const [cityId, setCityId] = useState('');
  const effectiveCity = cityId || citiesQ.data?.items[0]?.id || '';
  const faresQ = useAdminQuery<{ items: Fare[] }>(
    effectiveCity ? `/admin/fares?cityId=${effectiveCity}` : null,
  );
  const [serviceType, setServiceType] = useState('bike');
  const [fare, setFare] = useState(emptyFare);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const existing = faresQ.data?.items.find((f) => f.serviceType === serviceType);
    if (existing) {
      setFare({
        baseFarePaise: existing.baseFarePaise,
        perKmPaise: existing.perKmPaise,
        perMinutePaise: existing.perMinutePaise,
        minimumFarePaise: existing.minimumFarePaise,
        nightMultiplier: existing.nightMultiplier,
        surgeMultiplier: existing.surgeMultiplier,
        waitingPerMinutePaise: existing.waitingPerMinutePaise,
        cancellationFeePaise: existing.cancellationFeePaise,
        platformFeePaise: existing.platformFeePaise,
      });
    } else {
      setFare(emptyFare);
    }
  }, [faresQ.data, serviceType]);

  async function toggleService(type: string, enabled: boolean) {
    await adminFetch(`/admin/services/${type}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
    servicesQ.reload();
  }

  async function saveFare() {
    if (!effectiveCity) return;
    setErr(null);
    try {
      await adminFetch('/admin/fares', {
        method: 'PUT',
        body: JSON.stringify({ cityId: effectiveCity, serviceType, ...fare }),
      });
      setMsg('Fare rule saved');
      faresQ.reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Save failed');
    } finally {
      setConfirmOpen(false);
    }
  }

  async function runPreview(e: FormEvent) {
    e.preventDefault();
    if (!effectiveCity) return;
    try {
      const data = await adminFetch<{ breakdown: { totalPaise: number } }>('/admin/fares/preview', {
        method: 'POST',
        body: JSON.stringify({
          cityId: effectiveCity,
          serviceType,
          distanceM: 8400,
          durationSec: 1200,
          waitingSec: 0,
          isNight: false,
          applySurge: true,
        }),
      });
      setPreview(`Preview total: ₹${(data.breakdown.totalPaise / 100).toFixed(2)}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Preview failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Services & fares</h1>
        <p className="text-sm text-slate-500">Money values are integer paise. Confirm before saving fare rules.</p>
      </div>
      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}
      {err ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Services</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(servicesQ.data?.items ?? []).map((s) => (
            <label key={s.type} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-slate-400">{s.type}</span>
              </span>
              <input type="checkbox" checked={s.enabled} onChange={(e) => void toggleService(s.type, e.target.checked)} />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            City
            <select
              className="ml-2 rounded-lg border px-2 py-1.5"
              value={effectiveCity}
              onChange={(e) => setCityId(e.target.value)}
            >
              {(citiesQ.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Service
            <select
              className="ml-2 rounded-lg border px-2 py-1.5"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              {['bike', 'auto', 'parcel', 'logistics'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(fare) as Array<keyof typeof fare>).map((key) => (
            <label key={key} className="text-xs font-medium text-slate-500">
              {key}
              <input
                type="number"
                step="any"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900"
                value={fare[key]}
                onChange={(e) => setFare({ ...fare, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setConfirmOpen(true)}
          >
            Save fare rule
          </button>
          <button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={(e) => void runPreview(e)}>
            Preview (8.4 km / 20 min)
          </button>
        </div>
        {preview ? <p className="mt-3 text-sm font-medium text-slate-700">{preview}</p> : null}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm fare change"
        body={`Update ${serviceType} fares for selected city?\nBase ${fare.baseFarePaise} paise · perKm ${fare.perKmPaise} · min ${fare.minimumFarePaise}`}
        confirmLabel="Save fares"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void saveFare()}
      />
    </div>
  );
}
