import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, MAP_ID, mapsConfigured } from '../lib/googleMaps';

type Pt = { lat: number; lng: number };

/** Small map: click to set a point. Falls back to typing lat/lng if Maps isn't configured. */
export function CenterPicker({ value, onChange }: { value: Pt; onChange: (p: Pt) => void }) {
  const div = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const pin = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    if (!mapsConfigured()) {
      setError('Google Maps is not configured, so type lat/lng instead.');
      return;
    }
    loadGoogleMaps()
      .then(() => !off && setReady(true))
      .catch((e: unknown) => !off && setError(e instanceof Error ? e.message : 'Maps failed to load'));
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !div.current || map.current) return;
    const m = new google.maps.Map(div.current, {
      center: value,
      zoom: 11,
      mapId: MAP_ID,
      clickableIcons: false,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'greedy',
    });
    const marker = new google.maps.marker.AdvancedMarkerElement({ map: m, position: value });
    m.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const p = e.latLng.toJSON();
      cb.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
    });
    map.current = m;
    pin.current = marker;
  }, [ready, value]);

  // keep pin + view in sync with typed values / selected city
  useEffect(() => {
    if (!pin.current || !map.current) return;
    if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return;
    pin.current.position = value;
    map.current.setCenter(value);
  }, [value.lat, value.lng]);

  if (error) return <p className="text-xs text-amber-700">{error}</p>;
  return (
    <div>
      <div ref={div} className="h-56 w-full rounded-xl border border-slate-200 bg-slate-100" />
      <p className="mt-1 text-xs text-slate-500">Click the map to set the city centre.</p>
    </div>
  );
}
