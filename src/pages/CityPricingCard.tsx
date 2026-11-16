import { useState } from 'react';
import { adminFetch } from '../lib/adminFetch';

export type RushBand = { start: string; end: string; multiplier: number };
export type CityPricing = { nightStart: string; nightEnd: string; rushHours: RushBand[]; maxMultiplier: number };

type CityLike = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  timezone?: string;
  center: { lng: number; lat: number };
  services: string[];
  pricing: CityPricing;
};

const MAX = 1.5;
const MULTIPLIERS = [1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.5];

/**
 * Per-city price timing. Night multiplier itself is per service (Services & fares);
 * rush-hour bands carry their own multiplier; the cap limits everything combined.
 */
export function CityPricingCard({ city, onSaved }: { city: CityLike; onSaved: () => void }) {
  const [p, setP] = useState<CityPricing>(city.pricing);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nightOff = p.nightStart === p.nightEnd;

  const setBand = (i: number, patch: Partial<RushBand>) =>
    setP({ ...p, rushHours: p.rushHours.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  async function save() {
    setErr(null);
    if (p.rushHours.some((b) => b.start === b.end)) {
      setErr('A rush-hour band needs different start and end times.');
      return;
    }
    setSaving(true);
    try {
      await adminFetch(`/admin/cities/${city.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: city.name,
          slug: city.slug,
          enabled: city.enabled,
          timezone: city.timezone ?? 'Asia/Kolkata',
          center: city.center,
          services: city.services,
          pricing: p,
        }),
      });
      onSaved();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="pricing-times">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pricing-times" className="font-semibold">
          Pricing times · {city.name}
        </h2>
        <span className="text-xs text-slate-500">Times in {city.timezone ?? 'Asia/Kolkata'} (24-hour)</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Riders see the reason on the fare screen (“Night fare”, “Rush hour”, “High demand”, “Heavy traffic”). The price
        is locked once they book.
      </p>
      {err ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <fieldset>
          <legend className="text-sm font-medium">Night hours</legend>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="time"
              aria-label="Night starts"
              className="rounded-lg border px-3 py-2 text-sm"
              value={p.nightStart}
              onChange={(e) => setP({ ...p, nightStart: e.target.value })}
            />
            <span className="text-sm text-slate-500">to</span>
            <input
              type="time"
              aria-label="Night ends"
              className="rounded-lg border px-3 py-2 text-sm"
              value={p.nightEnd}
              onChange={(e) => setP({ ...p, nightEnd: e.target.value })}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {nightOff
              ? 'Night fare is off (same start and end).'
              : 'Uses each service’s night multiplier from Services & fares. May cross midnight.'}
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Rush hours</legend>
          <ul className="mt-2 space-y-2">
            {p.rushHours.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  aria-label={`Rush hour ${i + 1} starts`}
                  className="rounded-lg border px-2 py-2 text-sm"
                  value={b.start}
                  onChange={(e) => setBand(i, { start: e.target.value })}
                />
                <span className="text-sm text-slate-500">to</span>
                <input
                  type="time"
                  aria-label={`Rush hour ${i + 1} ends`}
                  className="rounded-lg border px-2 py-2 text-sm"
                  value={b.end}
                  onChange={(e) => setBand(i, { end: e.target.value })}
                />
                <select
                  aria-label={`Rush hour ${i + 1} multiplier`}
                  className="rounded-lg border px-2 py-2 text-sm"
                  value={b.multiplier}
                  onChange={(e) => setBand(i, { multiplier: Number(e.target.value) })}
                >
                  {MULTIPLIERS.map((m) => (
                    <option key={m} value={m}>
                      {m}×
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-full px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => setP({ ...p, rushHours: p.rushHours.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {p.rushHours.length < 6 ? (
            <button
              type="button"
              className="mt-2 rounded-full border px-3 py-2 text-sm"
              onClick={() =>
                setP({
                  ...p,
                  rushHours: [...p.rushHours, p.rushHours.length ? { start: '17:00', end: '20:00', multiplier: 1.1 } : { start: '08:00', end: '11:00', multiplier: 1.1 }],
                })
              }
            >
              + Add rush hour
            </button>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            {p.rushHours.length ? 'All services. If bands overlap, the higher one is used.' : 'No rush-hour pricing.'}
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Overall cap</legend>
          <select
            aria-label="Overall price cap"
            className="mt-2 rounded-lg border px-3 py-2 text-sm"
            value={p.maxMultiplier}
            onChange={(e) => setP({ ...p, maxMultiplier: Number(e.target.value) })}
          >
            {[1, 1.1, 1.2, 1.25, 1.3, 1.4, MAX].map((m) => (
              <option key={m} value={m}>
                {m === 1 ? 'No extra charges (1×)' : `${m}× normal fare`}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Night × rush hour × high demand × traffic together never go above this. Max {MAX}×.
          </p>
        </fieldset>
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={saving}
          className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Save pricing times'}
        </button>
      </div>
    </section>
  );
}
