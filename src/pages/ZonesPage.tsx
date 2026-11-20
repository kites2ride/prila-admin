import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { adminFetch, AdminApiError } from '../lib/adminFetch';
import { loadGoogleMaps, MAP_ID, mapsConfigured } from '../lib/googleMaps';
import { areaKm2, fromGeoJson, parseLatLng, toGeoJson, validateZone, type LatLng } from '../lib/polygon';
import { useAdminQuery } from '../lib/useAdminQuery';

type ServiceType = 'bike' | 'auto' | 'parcel' | 'logistics';
const SERVICES: ServiceType[] = ['bike', 'auto', 'parcel', 'logistics'];

type City = { id: string; name: string; center: { lng: number; lat: number } };
type Zone = {
  id: string;
  cityId: string;
  name: string;
  enabled: boolean;
  type: 'service' | 'blocked';
  services: ServiceType[];
  district: string;
  version: number;
  areaKm2: number | null;
  coordinates: number[][][];
};
type Enforcement = { enforce: boolean; serviceZonesExist: boolean; active: boolean };
type ZonesPayload = { items: Zone[]; enforcement: Enforcement };
type Demand = { items: Array<{ cell: string; kind: 'pickup' | 'drop'; count: number; lat: number; lng: number; reasons: string[] }> };
type TestResult = {
  enforced: boolean;
  allowedNow: boolean;
  allowedWhenEnforced: boolean;
  reason: string | null;
  message: string | null;
  cityName: string | null;
  zone: { name: string; district: string } | null;
  blockedBy: { name: string } | null;
};

type Form = { cityId: string; name: string; type: 'service' | 'blocked'; district: string; services: ServiceType[]; enabled: boolean };
const EMPTY_FORM: Form = { cityId: '', name: '', type: 'service', district: '', services: [], enabled: true };

const COLORS = {
  service: '#16A34A',
  blocked: '#DC2626',
  disabled: '#94A3B8',
  editing: '#7C3AED',
  demand: '#F97316',
};

function zoneColor(z: Pick<Zone, 'type' | 'enabled'>) {
  if (!z.enabled) return COLORS.disabled;
  return z.type === 'blocked' ? COLORS.blocked : COLORS.service;
}

export function ZonesPage() {
  const citiesQ = useAdminQuery<{ items: City[] }>('/admin/cities');
  const [cityId, setCityId] = useState('');
  const activeCityId = cityId || citiesQ.data?.items[0]?.id || '';
  const city = citiesQ.data?.items.find((c) => c.id === activeCityId);
  const zonesQ = useAdminQuery<ZonesPayload>(activeCityId ? `/admin/zones?cityId=${activeCityId}` : null);
  const [showDemand, setShowDemand] = useState(false);
  const demandQ = useAdminQuery<Demand>(showDemand ? '/admin/zones/demand-outside?days=7&limit=100' : null);

  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsAttempt, setMapsAttempt] = useState(0);

  // editor
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined); // undefined = not editing, null = new
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [drawing, setDrawing] = useState(false);
  const [vertexTick, setVertexTick] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // test a point
  const [testText, setTestText] = useState('');
  const [testService, setTestService] = useState<ServiceType | ''>('');
  const [testRole, setTestRole] = useState<'pickup' | 'drop' | 'pilot'>('pickup');
  const [pickingPoint, setPickingPoint] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);

  const mapDiv = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const staticPolys = useRef(new Map<string, google.maps.Polygon>());
  const editPoly = useRef<google.maps.Polygon | null>(null);
  const editPathListeners = useRef<google.maps.MapsEventListener[]>([]);
  const testMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const demandCircles = useRef<google.maps.Circle[]>([]);

  // Latest values for map listeners (registered once).
  const live = useRef({ drawing, pickingPoint, editing: editingId !== undefined });
  live.current = { drawing, pickingPoint, editing: editingId !== undefined };

  const zones = useMemo(() => zonesQ.data?.items ?? [], [zonesQ.data]);
  const enforcement = zonesQ.data?.enforcement;

  // ---------- load Google Maps once
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

  // ---------- create the map once
  const runTest = useCallback(
    async (pt: LatLng) => {
      setTestErr(null);
      setTestText(`${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`);
      if (map.current) {
        if (!testMarker.current) {
          const pin = document.createElement('div');
          pin.className = 'h-4 w-4 rounded-full border-2 border-white bg-violet-600 shadow';
          testMarker.current = new google.maps.marker.AdvancedMarkerElement({ map: map.current, content: pin, zIndex: 50 });
        }
        testMarker.current.position = pt;
        testMarker.current.map = map.current;
      }
      try {
        const r = await adminFetch<TestResult>('/admin/zones/test-point', {
          method: 'POST',
          body: JSON.stringify({ ...pt, role: testRole, serviceType: testService || undefined }),
        });
        setTestResult(r);
      } catch (e) {
        setTestResult(null);
        setTestErr(e instanceof Error ? e.message : 'Test failed');
      }
    },
    [testRole, testService],
  );
  const runTestRef = useRef(runTest);
  runTestRef.current = runTest;

  useEffect(() => {
    if (!mapsReady || !mapDiv.current || map.current) return;
    const m = new google.maps.Map(mapDiv.current, {
      center: { lat: 17.99, lng: 79.56 },
      zoom: 12,
      mapId: MAP_ID,
      clickableIcons: false,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'greedy',
    });
    map.current = m;
    const l = m.addListener('click', (e) => {
      if (!e.latLng) return;
      const pt = e.latLng.toJSON();
      if (live.current.pickingPoint) {
        setPickingPoint(false);
        void runTestRef.current(pt);
        return;
      }
      if (live.current.editing && live.current.drawing && editPoly.current) {
        editPoly.current.getPath().push(new google.maps.LatLng(pt.lat, pt.lng));
      }
    });
    return () => l.remove();
  }, [mapsReady]);

  // cursor feedback
  useEffect(() => {
    map.current?.setOptions({ draggableCursor: pickingPoint || (editingId !== undefined && drawing) ? 'crosshair' : null });
  }, [pickingPoint, drawing, editingId, mapsReady]);

  // centre on city change
  useEffect(() => {
    if (map.current && city) {
      map.current.setCenter(city.center);
      map.current.setZoom(12);
    }
  }, [city, mapsReady]);

  // ---------- draw saved zones
  useEffect(() => {
    if (!mapsReady || !map.current) return;
    for (const p of staticPolys.current.values()) {
      google.maps.event.clearInstanceListeners(p);
      p.setMap(null);
    }
    staticPolys.current.clear();
    for (const z of zones) {
      const color = zoneColor(z);
      const poly = new google.maps.Polygon({
        map: map.current,
        paths: fromGeoJson(z.coordinates),
        strokeColor: color,
        strokeWeight: 2,
        strokeOpacity: z.enabled ? 0.9 : 0.6,
        fillColor: color,
        fillOpacity: z.enabled ? (z.type === 'blocked' ? 0.3 : 0.18) : 0.08,
        zIndex: z.type === 'blocked' ? 20 : 10,
        visible: z.id !== editingId,
      });
      poly.addListener('click', (e) => {
        if (live.current.pickingPoint && e.latLng) {
          setPickingPoint(false);
          void runTestRef.current(e.latLng.toJSON());
          return;
        }
        if (live.current.editing) return; // finish/cancel the current edit first
        startEdit(z);
      });
      staticPolys.current.set(z.id, poly);
    }
  }, [zones, mapsReady]);

  useEffect(() => {
    for (const [id, p] of staticPolys.current) p.setVisible(id !== editingId);
  }, [editingId]);

  // ---------- demand overlay
  useEffect(() => {
    for (const c of demandCircles.current) c.setMap(null);
    demandCircles.current = [];
    if (!showDemand || !mapsReady || !map.current) return;
    for (const d of demandQ.data?.items ?? []) {
      demandCircles.current.push(
        new google.maps.Circle({
          map: map.current,
          center: { lat: d.lat, lng: d.lng },
          radius: Math.min(1500, 250 + 120 * Math.sqrt(d.count)),
          strokeColor: COLORS.demand,
          strokeWeight: 1,
          fillColor: COLORS.demand,
          fillOpacity: 0.25,
          clickable: false,
          zIndex: 30,
        }),
      );
    }
  }, [showDemand, demandQ.data, mapsReady]);

  // cleanup on unmount
  useEffect(
    () => () => {
      for (const p of staticPolys.current.values()) p.setMap(null);
      stopEditPoly();
      for (const c of demandCircles.current) c.setMap(null);
      if (testMarker.current) testMarker.current.map = null;
    },
    [],
  );

  // ---------- editor
  function stopEditPoly() {
    for (const l of editPathListeners.current) l.remove();
    editPathListeners.current = [];
    if (editPoly.current) {
      google.maps.event.clearInstanceListeners(editPoly.current);
      editPoly.current.setMap(null);
      editPoly.current = null;
    }
  }

  function startEdit(z: Zone | null) {
    if (!map.current) return;
    stopEditPoly();
    setMsg(null);
    setErr(null);
    const path = new google.maps.MVCArray<google.maps.LatLng>(
      z ? fromGeoJson(z.coordinates).map((p) => new google.maps.LatLng(p.lat, p.lng)) : [],
    );
    const poly = new google.maps.Polygon({
      map: map.current,
      editable: true,
      strokeColor: COLORS.editing,
      strokeWeight: 3,
      fillColor: COLORS.editing,
      fillOpacity: 0.15,
      zIndex: 40,
    });
    // Set the path after construction: an EMPTY `paths` option (new zone) makes Google create no
    // path at all, so getPath() would be undefined and the "+ New zone" click would crash.
    poly.setPath(path);
    // Right-click a point to delete it.
    poly.addListener('rightclick', (e) => {
      if (e.vertex !== undefined && poly.getPath().getLength() > 0) poly.getPath().removeAt(e.vertex);
    });
    const bump = () => setVertexTick((t) => t + 1);
    editPathListeners.current = [
      poly.getPath().addListener('insert_at', bump),
      poly.getPath().addListener('remove_at', bump),
      poly.getPath().addListener('set_at', bump),
    ];
    editPoly.current = poly;
    setEditingId(z ? z.id : null);
    setForm(
      z
        ? { cityId: z.cityId, name: z.name, type: z.type, district: z.district, services: z.services, enabled: z.enabled }
        : { ...EMPTY_FORM, cityId: activeCityId, district: '' },
    );
    setDrawing(!z); // new zone: start in "add points" mode
    bump();
  }

  function cancelEdit() {
    stopEditPoly();
    setEditingId(undefined);
    setDrawing(false);
    setForm(EMPTY_FORM);
  }

  const points: LatLng[] = useMemo(() => {
    void vertexTick;
    return editPoly.current ? editPoly.current.getPath().getArray().map((p) => p.toJSON()) : [];
  }, [vertexTick, editingId]);
  const shapeError = editingId !== undefined ? validateZone(points) : null;
  const area = areaKm2(points);
  const editingZone = zones.find((z) => z.id === editingId);
  const formError = !form.name.trim() ? 'Give the zone a name.' : null;

  async function save() {
    if (editingId === undefined || !activeCityId) return;
    setConfirmOpen(false);
    setSaving(true);
    setErr(null);
    try {
      const body = {
        cityId: form.cityId || activeCityId,
        name: form.name.trim(),
        type: form.type,
        district: form.district.trim(),
        services: form.services,
        enabled: form.enabled,
        coordinates: toGeoJson(points),
        ...(editingZone ? { expectedVersion: editingZone.version } : {}),
      };
      await adminFetch(editingId ? `/admin/zones/${editingId}` : '/admin/zones', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      setMsg(`Zone "${body.name}" saved.`);
      cancelEdit();
      zonesQ.reload();
    } catch (e) {
      setErr(
        e instanceof AdminApiError && e.code === 'VERSION_CONFLICT'
          ? 'Someone else changed this zone. Cancel, reload and edit again.'
          : e instanceof Error
            ? e.message
            : 'Save failed',
      );
    } finally {
      setSaving(false);
    }
  }

  const confirmBody = editingId !== undefined
    ? [
        `${editingId ? 'Update' : 'Create'} ${form.type} zone "${form.name.trim()}" in ${city?.name ?? 'this city'}.`,
        `Area ${area.toFixed(2)} km² · ${points.length} points · services: ${form.services.length ? form.services.join(', ') : 'all'} · ${form.enabled ? 'enabled' : 'disabled'}.`,
        form.type === 'blocked'
          ? 'Riders will NOT be able to start rides inside this area.'
          : 'Riders can book and pilots can go online inside this area.',
        'This takes effect immediately and is recorded in the audit log.',
      ].join('\n')
    : '';

  function testFromText() {
    const pt = parseLatLng(testText);
    if (!pt) {
      setTestErr('Enter "lat, lng" e.g. 17.9950, 79.5560');
      return;
    }
    void runTest(pt);
  }

  // ---------- UI
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Zones</h1>
          <p className="text-sm text-slate-500">
            Green = service (rides allowed). Red = blocked (no pickups). Grey = disabled. The server enforces these on
            estimate, booking and pilot go-online.
          </p>
        </div>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={activeCityId}
          onChange={(e) => {
            cancelEdit();
            setCityId(e.target.value);
          }}
        >
          {(citiesQ.data?.items ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {enforcement && !enforcement.active ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {!enforcement.serviceZonesExist
            ? 'No enabled service zone exists yet, so the service area is NOT enforced (riders can book anywhere). Draw at least one service zone to turn it on.'
            : 'Enforcement is switched off in Zone rules (zones.enforce = false). Zones are shown but not applied.'}
        </div>
      ) : null}
      {msg ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}
      {err ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div> : null}
      {zonesQ.error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{zonesQ.error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div ref={mapDiv} className="h-[620px] w-full" />
          {mapsError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 p-6 text-center text-sm text-slate-700">
              <p>{mapsError}</p>
              {mapsConfigured() ? (
                <button
                  type="button"
                  className="rounded-full bg-violet-600 px-4 py-2 font-medium text-white"
                  onClick={() => setMapsAttempt((n) => n + 1)}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : !mapsReady ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Loading map…</div>
          ) : null}
          {editingId !== undefined && drawing ? (
            <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-700 shadow">
              Click the map to add points. Drag points to move them, drag the small mid-points to add more, right-click a
              point to delete it.
            </div>
          ) : null}
          {pickingPoint ? (
            <div className="absolute left-3 top-3 rounded-xl bg-violet-600 px-3 py-2 text-xs text-white shadow">
              Click anywhere on the map to test that point.
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {editingId !== undefined ? (
            <section className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4">
              <h2 className="font-semibold">{editingId ? `Edit zone (v${editingZone?.version ?? 1})` : 'New zone'}</h2>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name, e.g. Hanamkonda core"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Form['type'] })}
                >
                  <option value="service">Service (rides allowed)</option>
                  <option value="blocked">Blocked (no pickups)</option>
                </select>
                <select
                  className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.cityId || activeCityId}
                  onChange={(e) => setForm({ ...form, cityId: e.target.value })}
                  aria-label="City this zone belongs to"
                >
                  {(citiesQ.data?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      City: {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="District (optional)"
                  value={form.district}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600">Services (none ticked = all services)</div>
                <div className="mt-1 flex flex-wrap gap-3 text-sm">
                  {SERVICES.map((s) => (
                    <label key={s} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={form.services.includes(s)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            services: e.target.checked ? [...form.services, s] : form.services.filter((x) => x !== s),
                          })
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                Enabled
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-1.5 text-sm ${drawing ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200'}`}
                  onClick={() => setDrawing((d) => !d)}
                >
                  {drawing ? 'Adding points: on' : 'Add points'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
                  disabled={points.length === 0}
                  onClick={() => editPoly.current?.getPath().pop()}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
                  disabled={points.length === 0}
                  onClick={() => {
                    editPoly.current?.getPath().clear();
                    setDrawing(true);
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="text-xs text-slate-500">
                {points.length} points · {area.toFixed(2)} km²
              </div>
              {shapeError || formError ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{shapeError ?? formError}</div>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={Boolean(shapeError || formError) || saving}
                  onClick={() => setConfirmOpen(true)}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="rounded-full border border-slate-200 px-4 py-2 text-sm" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Zones in {city?.name ?? '…'}</h2>
                <button
                  type="button"
                  className="rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  disabled={!mapsReady || !activeCityId}
                  onClick={() => startEdit(null)}
                >
                  + New zone
                </button>
              </div>
              {zonesQ.loading ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : null}
              {!zonesQ.loading && zones.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No zones yet. Click “New zone” and click on the map to draw.</p>
              ) : null}
              <ul className="mt-3 space-y-2">
                {zones.map((z) => (
                  <li key={z.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-slate-100 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                      disabled={!mapsReady}
                      onClick={() => startEdit(z)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: zoneColor(z) }} />
                        <span className="font-medium">{z.name}</span>
                        <span className="ml-auto text-xs text-slate-400">v{z.version}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {z.type}
                        {z.district ? ` · ${z.district}` : ''} · {z.services.length ? z.services.join(', ') : 'all services'}
                        {z.areaKm2 != null ? ` · ${z.areaKm2} km²` : ''}
                        {z.enabled ? '' : ' · disabled'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Test a point</h2>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="17.9950, 79.5560"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && testFromText()}
              />
              <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" onClick={testFromText}>
                Test
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={testRole}
                onChange={(e) => setTestRole(e.target.value as typeof testRole)}
              >
                <option value="pickup">as rider pickup</option>
                <option value="drop">as rider drop</option>
                <option value="pilot">as pilot going online</option>
              </select>
              <select
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={testService}
                onChange={(e) => setTestService(e.target.value as ServiceType | '')}
              >
                <option value="">any service</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${pickingPoint ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-slate-200'}`}
              disabled={!mapsReady}
              onClick={() => setPickingPoint((p) => !p)}
            >
              {pickingPoint ? 'Click on the map… (cancel)' : 'Pick a point on the map'}
            </button>
            {testErr ? <p className="text-sm text-red-600">{testErr}</p> : null}
            {testResult ? (
              <div
                className={`rounded-xl px-3 py-2 text-sm ${
                  testResult.allowedWhenEnforced ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                }`}
              >
                <div className="font-semibold">{testResult.allowedWhenEnforced ? 'In service ✓' : 'Not allowed ✕'}</div>
                {testResult.zone ? (
                  <div>
                    Zone: {testResult.zone.name}
                    {testResult.cityName ? ` · ${testResult.cityName}` : ''}
                  </div>
                ) : null}
                {testResult.blockedBy ? <div>Blocked by: {testResult.blockedBy.name}</div> : null}
                {testResult.message ? <div className="mt-1 italic">“{testResult.message}”</div> : null}
                {!testResult.enforced ? (
                  <div className="mt-1 text-xs text-amber-700">
                    Enforcement is currently OFF, so the server allows everything right now.
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={showDemand} onChange={(e) => setShowDemand(e.target.checked)} />
              Demand outside zones (last 7 days)
            </label>
            {showDemand ? (
              demandQ.loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (demandQ.data?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No turned-away requests yet.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto text-xs text-slate-600">
                  {demandQ.data?.items.slice(0, 15).map((d) => (
                    <li key={`${d.cell}-${d.kind}`} className="flex justify-between gap-2">
                      <span>
                        {d.kind} · {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                      </span>
                      <span className="font-semibold">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={editingId ? 'Save zone changes?' : 'Create zone?'}
        body={confirmBody}
        confirmLabel="Save zone"
        onConfirm={() => void save()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
