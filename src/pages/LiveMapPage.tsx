import { useEffect, useMemo, useRef, useState } from 'react';
import { adminFetch } from '../lib/adminFetch';
import { loadGoogleMaps, MAP_ID, mapsConfigured } from '../lib/googleMaps';
import { navigate } from '../lib/pathRouter';
import { fromGeoJson } from '../lib/polygon';
import { useAdminQuery } from '../lib/useAdminQuery';

/* ───────────────────────── types (GET /admin/dispatch/live) ───────────────────────── */

type City = { id: string; name: string; center: { lng: number; lat: number } };
type PilotStatus = 'idle' | 'offered' | 'on_ride';
type LivePilot = {
  id: string;
  name: string | null;
  vehicleType: string | null;
  vehicleNumber: string | null;
  status: PilotStatus;
  stale: boolean;
  lat: number;
  lng: number;
  lastSeenSec: number;
};
type Place = { name: string | null; lat: number; lng: number } | null;
type LiveRide = {
  id: string;
  status: string;
  searching: boolean;
  serviceType: string;
  pickup: Place;
  drop: Place;
  pilotId: string | null;
  pilotName: string | null;
  ageSec: number;
};
type Counts = { idle: number; offered: number; onRide: number; stale: number; searching: number; activeRides: number };
type Live = { at: string; staleAfterSec: number; counts: Counts; pilots: LivePilot[]; rides: LiveRide[]; truncated: boolean };
type Zone = { id: string; enabled: boolean; type: 'service' | 'blocked'; coordinates: number[][][] };
type Heat = { enabled: boolean; items: Array<{ cell: string; demand: number; supply: number; boundary: Array<[number, number]> }> };
type TurnedAway = { items: Array<{ cell: string; count: number; boundary: Array<[number, number]> }> };

/* ───────────────────────── constants ───────────────────────── */

const POLL_MS = 5_000; // owner-approved: pilots send GPS every ~4 s
const HEAT_POLL_MS = 30_000; // busy-area window is 10 min; no need for faster
const LATE_AFTER_MS = 15_000; // 3 missed polls → show "not updating"
const CITY_KEY = 'prila.liveMap.city';

const C = {
  idle: '#16A34A',
  offered: '#F59E0B',
  onRide: '#8B2CF5',
  stale: '#94A3B8',
  pickup: '#5BD100',
  drop: '#FF2D95',
  zone: '#16A34A',
  blocked: '#DC2626',
};

type Focus = 'idle' | 'offered' | 'onRide' | 'stale' | 'searching' | 'active' | null;
type Layers = { pilots: boolean; rides: boolean; zones: boolean; busy: boolean; turnedAway: boolean };
type Selected = { kind: 'pilot' | 'ride'; id: string } | null;

const VEHICLE_LETTER: Record<string, string> = { bike: 'B', auto: 'A', parcel: 'P', logistics: 'L' };

function pilotKind(p: LivePilot): Exclude<Focus, 'searching' | 'active' | null> {
  if (p.stale) return 'stale';
  return p.status === 'on_ride' ? 'onRide' : p.status;
}

const RIDE_LABEL: Record<string, string> = {
  requested: 'Looking for a pilot',
  searching: 'Looking for a pilot',
  pilot_assigned: 'Pilot going to pickup',
  pilot_arriving: 'Pilot going to pickup',
  pilot_arrived: 'Pilot at pickup',
  in_progress: 'On trip',
};
const PILOT_LABEL: Record<string, string> = { idle: 'Free', offered: 'Deciding on a ride', onRide: 'On a ride', stale: 'No GPS' };

function ago(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  return `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min`;
}

function readCity(): string {
  try {
    return localStorage.getItem(CITY_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveCity(id: string) {
  try {
    localStorage.setItem(CITY_KEY, id);
  } catch {
    /* private mode — fine */
  }
}

/* ───────────────────────── marker DOM ───────────────────────── */

function pilotPin(p: LivePilot): HTMLElement {
  const kind = pilotKind(p);
  const el = document.createElement('div');
  el.style.cssText = `width:24px;height:24px;border-radius:9999px;background:${C[kind]};border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font:700 11px/20px system-ui,sans-serif;text-align:center;cursor:pointer`;
  el.textContent = VEHICLE_LETTER[p.vehicleType ?? ''] ?? '•';
  return el;
}

function searchingPin(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'prila-live-pulse';
  el.style.cssText = `width:16px;height:16px;border-radius:9999px;background:${C.drop};border:2px solid #fff;cursor:pointer`;
  return el;
}

function endPin(kind: 'pickup' | 'drop'): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `width:12px;height:12px;background:${kind === 'pickup' ? C.pickup : C.drop};border:2px solid #fff;
    border-radius:${kind === 'pickup' ? '9999px' : '3px'};box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:pointer`;
  return el;
}

/** Glide a marker to its new spot over ~1 s so 5 s updates look like movement, not jumps. */
function glide(m: google.maps.marker.AdvancedMarkerElement, to: google.maps.LatLngLiteral) {
  const from = m.position;
  if (!from || (Math.abs(from.lat - to.lat) < 1e-7 && Math.abs(from.lng - to.lng) < 1e-7)) {
    m.position = to;
    return;
  }
  // Big jumps (pilot reappeared far away) snap instead of sliding across town.
  if (Math.abs(from.lat - to.lat) > 0.02 || Math.abs(from.lng - to.lng) > 0.02) {
    m.position = to;
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / 1000);
    m.position = { lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k };
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ───────────────────────── page ───────────────────────── */

export function LiveMapPage() {
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const cities = useMemo(() => citiesQ.data?.items ?? [], [citiesQ.data]);
  const [pickedCity, setPickedCity] = useState(readCity);
  const cityId = cities.some((c) => c.id === pickedCity) ? pickedCity : (cities[0]?.id ?? '');
  const city = cities.find((c) => c.id === cityId);

  const [layers, setLayers] = useState<Layers>({ pilots: true, rides: true, zones: true, busy: false, turnedAway: false });
  const [focus, setFocus] = useState<Focus>(null);
  const [selected, setSelected] = useState<Selected>(null);

  const [snap, setSnap] = useState<Live | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [heat, setHeat] = useState<Heat | null>(null);

  const zonesQ = useAdminQuery<{ items: Zone[] }>(cityId && layers.zones ? `/admin/zones?cityId=${cityId}` : null);
  const awayQ = useAdminQuery<TurnedAway>(
    cityId && layers.turnedAway ? `/admin/zones/demand-outside?days=90&limit=500&cityId=${cityId}` : null,
  );

  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsAttempt, setMapsAttempt] = useState(0);
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);

  const pilotMarkers = useRef(new Map<string, { m: google.maps.marker.AdvancedMarkerElement; key: string }>());
  const rideObjs = useRef(
    new Map<string, { key: string; markers: google.maps.marker.AdvancedMarkerElement[]; line: google.maps.Polyline | null }>(),
  );
  const zonePolys = useRef<google.maps.Polygon[]>([]);
  const heatPolys = useRef<google.maps.Polygon[]>([]);
  const awayPolys = useRef<google.maps.Polygon[]>([]);

  /* ---------- 1 s clock for "updated Xs ago" */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------- poll the live snapshot every 5 s (paused while the tab is hidden) */
  useEffect(() => {
    if (!cityId) return;
    let stopped = false;
    let inflight = false;
    setSnap(null);
    setLastOkAt(null);
    setPollErr(null);
    setSelected(null);
    const tick = async () => {
      if (document.hidden || inflight) return;
      inflight = true;
      try {
        const d = await adminFetch<Live>(`/admin/dispatch/live?cityId=${cityId}`);
        if (stopped) return;
        setSnap(d);
        setLastOkAt(Date.now());
        setPollErr(null);
      } catch (e) {
        if (!stopped) setPollErr(e instanceof Error ? e.message : 'Update failed');
      } finally {
        inflight = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [cityId]);

  /* ---------- busy-areas layer: every 30 s while switched on */
  useEffect(() => {
    setHeat(null);
    if (!cityId || !layers.busy) return;
    let stopped = false;
    const load = () => {
      if (document.hidden) return;
      adminFetch<Heat>(`/admin/dispatch/heatmap?cityId=${cityId}`)
        .then((d) => !stopped && setHeat(d))
        .catch(() => {
          /* keep the last picture; the status line shows live-poll health */
        });
    };
    load();
    const t = window.setInterval(load, HEAT_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [cityId, layers.busy]);

  /* ---------- Google Maps */
  useEffect(() => {
    let cancelled = false;
    if (!mapsConfigured()) {
      setMapsError('Google Maps is not configured: set VITE_GOOGLE_MAPS_KEY and VITE_GOOGLE_MAP_ID in prila-admin/.env');
      return;
    }
    setMapsError(null);
    loadGoogleMaps()
      .then(() => !cancelled && setMapsReady(true))
      .catch((e: unknown) => !cancelled && setMapsError(e instanceof Error ? e.message : 'Google Maps failed to load'));
    return () => {
      cancelled = true;
    };
  }, [mapsAttempt]);

  useEffect(() => {
    if (!mapsReady || !mapDiv.current || map.current) return;
    map.current = new google.maps.Map(mapDiv.current, {
      center: { lat: 17.99, lng: 79.56 },
      zoom: 12,
      mapId: MAP_ID,
      clickableIcons: false,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'greedy',
    });
    const l = map.current.addListener('click', () => setSelected(null));
    return () => l.remove();
  }, [mapsReady]);

  useEffect(() => {
    if (map.current && city) {
      map.current.setCenter(city.center);
      map.current.setZoom(12);
    }
  }, [city, mapsReady]);

  /* ---------- pilots (diffed by id, glide on move) */
  useEffect(() => {
    const m = map.current;
    if (!mapsReady || !m) return;
    const want = new Map<string, LivePilot>();
    if (layers.pilots && snap) {
      for (const p of snap.pilots) {
        const kind = pilotKind(p);
        if (focus && focus !== kind) continue;
        want.set(p.id, p);
      }
    }
    for (const [id, o] of pilotMarkers.current) {
      if (!want.has(id)) {
        o.m.map = null;
        pilotMarkers.current.delete(id);
      }
    }
    for (const p of want.values()) {
      const key = `${pilotKind(p)}|${p.vehicleType}`;
      const title = `${p.name ?? 'Pilot'} · ${p.vehicleNumber ?? ''}`;
      const existing = pilotMarkers.current.get(p.id);
      if (existing) {
        if (existing.key !== key) {
          existing.m.content = pilotPin(p);
          existing.key = key;
        }
        existing.m.title = title;
        glide(existing.m, { lat: p.lat, lng: p.lng });
      } else {
        const mk = new google.maps.marker.AdvancedMarkerElement({
          map: m,
          position: { lat: p.lat, lng: p.lng },
          content: pilotPin(p),
          title,
          zIndex: 30,
          gmpClickable: true,
        });
        mk.addListener('click', () => setSelected({ kind: 'pilot', id: p.id }));
        pilotMarkers.current.set(p.id, { m: mk, key });
      }
    }
  }, [snap, layers.pilots, focus, mapsReady]);

  /* ---------- rides: searching = pink pulse at pickup; active = pickup ● ── ■ drop */
  useEffect(() => {
    const m = map.current;
    if (!mapsReady || !m) return;
    const want = new Map<string, LiveRide>();
    if (layers.rides && snap) {
      for (const r of snap.rides) {
        if (!r.pickup) continue;
        if (focus && !(focus === 'searching' && r.searching) && !(focus === 'active' && !r.searching)) continue;
        want.set(r.id, r);
      }
    }
    const drop = (id: string) => {
      const o = rideObjs.current.get(id);
      if (!o) return;
      for (const mk of o.markers) mk.map = null;
      o.line?.setMap(null);
      rideObjs.current.delete(id);
    };
    for (const id of [...rideObjs.current.keys()]) {
      const r = want.get(id);
      if (!r || rideObjs.current.get(id)!.key !== `${r.searching}`) drop(id);
    }
    for (const r of want.values()) {
      if (rideObjs.current.has(r.id)) continue;
      const select = () => setSelected({ kind: 'ride', id: r.id });
      const markers: google.maps.marker.AdvancedMarkerElement[] = [];
      let line: google.maps.Polyline | null = null;
      if (r.searching) {
        markers.push(
          new google.maps.marker.AdvancedMarkerElement({
            map: m, position: r.pickup, content: searchingPin(), zIndex: 40, gmpClickable: true, title: 'Rider looking for a pilot',
          }),
        );
      } else {
        markers.push(
          new google.maps.marker.AdvancedMarkerElement({ map: m, position: r.pickup, content: endPin('pickup'), zIndex: 20, gmpClickable: true }),
        );
        if (r.drop) {
          markers.push(
            new google.maps.marker.AdvancedMarkerElement({ map: m, position: r.drop, content: endPin('drop'), zIndex: 20, gmpClickable: true }),
          );
          line = new google.maps.Polyline({
            map: m,
            path: [r.pickup!, r.drop],
            strokeColor: C.onRide,
            strokeOpacity: 0,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, strokeWeight: 3, scale: 3 }, offset: '0', repeat: '12px' }],
            zIndex: 5,
          });
          line.addListener('click', select);
        }
      }
      for (const mk of markers) mk.addListener('click', select);
      rideObjs.current.set(r.id, { key: `${r.searching}`, markers, line });
    }
  }, [snap, layers.rides, focus, mapsReady]);

  /* ---------- zone outlines */
  useEffect(() => {
    for (const p of zonePolys.current) p.setMap(null);
    zonePolys.current = [];
    if (!mapsReady || !map.current || !layers.zones) return;
    for (const z of zonesQ.data?.items ?? []) {
      if (!z.enabled) continue;
      const color = z.type === 'blocked' ? C.blocked : C.zone;
      zonePolys.current.push(
        new google.maps.Polygon({
          map: map.current,
          paths: fromGeoJson(z.coordinates),
          strokeColor: color,
          strokeWeight: 2,
          strokeOpacity: 0.8,
          fillColor: color,
          fillOpacity: z.type === 'blocked' ? 0.15 : 0.04,
          clickable: false,
          zIndex: 1,
        }),
      );
    }
  }, [zonesQ.data, layers.zones, mapsReady]);

  /* ---------- Layer A: busy areas right now (riders vs free pilots, last 10 min) */
  useEffect(() => {
    for (const p of heatPolys.current) p.setMap(null);
    heatPolys.current = [];
    if (!mapsReady || !map.current || !layers.busy) return;
    for (const h of heat?.items ?? []) {
      if (h.demand <= 0) continue; // quiet → no colour
      const ratio = h.demand / Math.max(h.supply, 1);
      const color = ratio >= 2.5 ? '#DC2626' : ratio > 1 ? '#F97316' : '#FACC15';
      heatPolys.current.push(
        new google.maps.Polygon({
          map: map.current,
          paths: h.boundary.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: color,
          strokeWeight: 1,
          strokeOpacity: 0.7,
          fillColor: color,
          fillOpacity: 0.35,
          clickable: false,
          zIndex: 2,
        }),
      );
    }
  }, [heat, layers.busy, mapsReady]);

  /* ---------- Layer B: riders turned away (outside zones, last 90 days) */
  useEffect(() => {
    for (const p of awayPolys.current) p.setMap(null);
    awayPolys.current = [];
    if (!mapsReady || !map.current || !layers.turnedAway) return;
    const items = awayQ.data?.items ?? [];
    // pickup + drop rows share cells → sum per cell
    const byCell = new Map<string, { count: number; boundary: Array<[number, number]> }>();
    for (const i of items) {
      const cur = byCell.get(i.cell);
      byCell.set(i.cell, { count: (cur?.count ?? 0) + i.count, boundary: i.boundary });
    }
    const max = Math.max(1, ...[...byCell.values()].map((v) => v.count));
    for (const { count, boundary } of byCell.values()) {
      if (boundary.length < 3) continue;
      awayPolys.current.push(
        new google.maps.Polygon({
          map: map.current,
          paths: boundary.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: '#6D28D9',
          strokeWeight: 1,
          strokeOpacity: 0.6,
          fillColor: '#6D28D9',
          fillOpacity: 0.12 + 0.5 * (count / max),
          clickable: false,
          zIndex: 3,
        }),
      );
    }
  }, [awayQ.data, layers.turnedAway, mapsReady]);

  /* ---------- cleanup */
  useEffect(
    () => () => {
      for (const o of pilotMarkers.current.values()) o.m.map = null;
      for (const o of rideObjs.current.values()) {
        for (const mk of o.markers) mk.map = null;
        o.line?.setMap(null);
      }
      for (const p of [...zonePolys.current, ...heatPolys.current, ...awayPolys.current]) p.setMap(null);
    },
    [],
  );

  /* ---------- derived UI */
  const counts = snap?.counts;
  const sinceSec = lastOkAt ? Math.max(0, Math.round((now - lastOkAt) / 1000)) : null;
  const late = Boolean(pollErr) || (lastOkAt !== null && now - lastOkAt > LATE_AFTER_MS);

  const selPilot = selected?.kind === 'pilot' ? snap?.pilots.find((p) => p.id === selected.id) : undefined;
  const selRide = selected?.kind === 'ride' ? snap?.rides.find((r) => r.id === selected.id) : undefined;
  const pilotRide = selPilot ? snap?.rides.find((r) => r.pilotId === selPilot.id && !r.searching) : undefined;

  const statusRows: Array<{ id: Exclude<Focus, null>; label: string; color: string; value: number | undefined; shape?: 'pulse' | 'line' }> = [
    { id: 'idle', label: 'Free pilots', color: C.idle, value: counts?.idle },
    { id: 'offered', label: 'Deciding on a ride', color: C.offered, value: counts?.offered },
    { id: 'onRide', label: 'On a ride', color: C.onRide, value: counts?.onRide },
    { id: 'stale', label: 'No GPS (not getting rides)', color: C.stale, value: counts?.stale },
    { id: 'searching', label: 'Riders looking for a pilot', color: C.drop, value: counts?.searching, shape: 'pulse' },
    { id: 'active', label: 'Rides in progress', color: C.onRide, value: counts?.activeRides, shape: 'line' },
  ];

  const layerRows: Array<{ id: keyof Layers; label: string; hint?: string }> = [
    { id: 'pilots', label: 'Pilots' },
    { id: 'rides', label: 'Rides' },
    { id: 'zones', label: 'Service zones' },
    { id: 'busy', label: 'Busy areas right now', hint: 'Riders vs free pilots, last 10 min' },
    { id: 'turnedAway', label: 'Riders turned away', hint: 'Outside zones, last 90 days' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-[var(--prila-ink)]">Live map</h1>
        <select
          aria-label="City"
          className="field"
          value={cityId}
          onChange={(e) => {
            setPickedCity(e.target.value);
            saveCity(e.target.value);
            setFocus(null);
          }}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span
          className={`ml-auto text-sm ${late ? 'font-semibold text-red-600' : 'text-[var(--prila-muted)]'}`}
          role="status"
          aria-live="polite"
        >
          {sinceSec === null
            ? pollErr
              ? `Not updating: ${pollErr}`
              : 'Loading…'
            : late
              ? `Not updating — last update ${ago(sinceSec)} ago`
              : `Updated ${ago(sinceSec)} ago`}
        </span>
      </div>
      {citiesQ.error ? <p className="text-sm text-red-600">{citiesQ.error}</p> : null}
      {!citiesQ.loading && cities.length === 0 ? (
        <p className="text-sm text-[var(--prila-muted)]">No cities yet. Add one under Cities.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <section className="surface p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold">Right now</h2>
              {focus ? (
                <button type="button" className="text-xs font-medium text-[var(--prila-purple)]" onClick={() => setFocus(null)}>
                  Show all
                </button>
              ) : null}
            </div>
            <ul className="space-y-1">
              {statusRows.map((s) => {
                const active = focus === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFocus(active ? null : s.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors ${
                        active ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-[var(--prila-bg)]'
                      } ${focus && !active ? 'opacity-50' : ''}`}
                    >
                      {s.shape === 'line' ? (
                        <span className="h-0.5 w-4 shrink-0 rounded" style={{ background: s.color }} />
                      ) : (
                        <span
                          className={`h-3 w-3 shrink-0 rounded-full ${s.shape === 'pulse' ? 'prila-live-pulse' : ''}`}
                          style={{ background: s.color }}
                        />
                      )}
                      <span className="flex-1">{s.label}</span>
                      <span className="tabular-nums font-semibold">{s.value ?? '—'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-1 text-xs text-[var(--prila-muted)]">Click a row to show only those on the map.</p>
          </section>

          <section className="surface p-3">
            <h2 className="mb-2 px-1 text-sm font-semibold">Show on map</h2>
            <ul className="space-y-1">
              {layerRows.map((l) => (
                <li key={l.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--prila-bg)]">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[var(--prila-purple)]"
                      checked={layers[l.id]}
                      onChange={(e) => setLayers((v) => ({ ...v, [l.id]: e.target.checked }))}
                    />
                    <span>
                      {l.label}
                      {l.hint ? <span className="block text-xs text-[var(--prila-muted)]">{l.hint}</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {layers.busy ? (
              <div className="mt-2 space-y-1 px-1 text-xs text-[var(--prila-muted)]">
                <Legend color="#DC2626" text="Many more riders than free pilots — send pilots" />
                <Legend color="#F97316" text="More riders than free pilots" />
                <Legend color="#FACC15" text="Balanced" />
                {heat && !heat.enabled ? <p>Surge pricing is off; colours still show demand.</p> : null}
                {heat && heat.items.every((h) => h.demand <= 0) ? <p>No ride requests in the last 10 min.</p> : null}
              </div>
            ) : null}
            {layers.turnedAway ? (
              <div className="mt-2 space-y-1 px-1 text-xs text-[var(--prila-muted)]">
                <Legend color="#6D28D9" text="Darker = more riders turned away here" />
                {awayQ.error ? <p className="text-red-600">{awayQ.error}</p> : null}
                {awayQ.data && awayQ.data.items.length === 0 ? <p>Nobody turned away near this city yet.</p> : null}
              </div>
            ) : null}
          </section>

          {selected ? (
            <section className="surface p-4" aria-live="polite">
              <div className="mb-2 flex items-start justify-between">
                <h2 className="text-[15px] font-semibold text-[var(--prila-ink)]">{selected.kind === 'pilot' ? 'Pilot' : 'Ride'}</h2>
                <button type="button" aria-label="Close" className="text-[var(--prila-muted)]" onClick={() => setSelected(null)}>
                  ✕
                </button>
              </div>
              {selPilot ? (
                <dl className="space-y-1">
                  <Row k="Name" v={selPilot.name ?? '—'} />
                  <Row k="Vehicle" v={`${selPilot.vehicleNumber ?? '—'} · ${selPilot.vehicleType ?? ''}`} />
                  <Row k="Status" v={PILOT_LABEL[pilotKind(selPilot)] ?? selPilot.status} />
                  <Row k="Last GPS" v={`${ago(selPilot.lastSeenSec)} ago`} />
                  {pilotRide ? (
                    <Row k="Ride" v={`${pilotRide.pickup?.name ?? 'Pickup'} → ${pilotRide.drop?.name ?? 'Drop'}`} />
                  ) : null}
                  <div className="pt-2">
                    <button type="button" className="text-sm font-medium text-[var(--prila-purple)]" onClick={() => navigate('pilots')}>
                      Open Pilots →
                    </button>
                  </div>
                </dl>
              ) : selRide ? (
                <dl className="space-y-1">
                  <Row k="Status" v={RIDE_LABEL[selRide.status] ?? selRide.status} />
                  <Row k="Service" v={selRide.serviceType} />
                  <Row k="From" v={selRide.pickup?.name ?? '—'} />
                  <Row k="To" v={selRide.drop?.name ?? '—'} />
                  <Row k={selRide.searching ? 'Waiting' : 'Booked'} v={`${ago(selRide.ageSec)} ago`} />
                  {selRide.pilotName ? <Row k="Pilot" v={selRide.pilotName} /> : null}
                  <Row k="Ride ID" v={selRide.id} mono />
                  <div className="pt-2">
                    <button type="button" className="text-sm font-medium text-[var(--prila-purple)]" onClick={() => navigate('rides')}>
                      Open Rides →
                    </button>
                  </div>
                </dl>
              ) : (
                <p className="text-[var(--prila-muted)]">
                  {selected.kind === 'pilot' ? 'This pilot went offline.' : 'This ride has finished or was cancelled.'}
                </p>
              )}
            </section>
          ) : null}
        </aside>

        <div className="surface h-[calc(100vh-180px)] min-h-[520px] overflow-hidden">
          {mapsError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
              <p className="text-red-600">{mapsError}</p>
              {mapsConfigured() ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setMapsAttempt((a) => a + 1)}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : (
            <div ref={mapDiv} className="h-full w-full" />
          )}
          {snap?.truncated ? (
            <p className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs shadow">
              Showing the latest 1000 rides only.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-[var(--prila-muted)]">{k}</dt>
      <dd className={`min-w-0 break-words ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color, opacity: 0.7 }} />
      {text}
    </p>
  );
}
