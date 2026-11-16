/**
 * Client-side zone checks — mirror of prila-backend/src/modules/zones/geo.ts.
 * The server re-validates; this only gives ops instant feedback while drawing.
 */
export type LatLng = { lat: number; lng: number };

export const ZONE_LIMITS = { minVertices: 3, maxVertices: 500, minAreaKm2: 0.02, maxAreaKm2: 2500 } as const;

function project(pts: LatLng[]): Array<[number, number]> {
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  return pts.map((p) => [p.lng * kx, p.lat * 110.574]);
}

function orient(a: [number, number], b: [number, number], c: [number, number]) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return v > 1e-12 ? 1 : v < -1e-12 ? -1 : 0;
}

function onSeg(a: [number, number], b: [number, number], p: [number, number]) {
  return (
    Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])
  );
}

function cross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) || (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b));
}

export function areaKm2(pts: LatLng[]): number {
  if (pts.length < 3) return 0;
  const p = project(pts);
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

/** @returns null when valid, else a human message. */
export function validateZone(pts: LatLng[]): string | null {
  if (pts.length < ZONE_LIMITS.minVertices) return `Add at least ${ZONE_LIMITS.minVertices} points (click on the map).`;
  if (pts.length > ZONE_LIMITS.maxVertices) return `Too many points (max ${ZONE_LIMITS.maxVertices}).`;
  const p = project(pts);
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (cross(p[i]!, p[(i + 1) % n]!, p[j]!, p[(j + 1) % n]!)) {
        return 'The outline crosses itself. Drag points so the edges do not cross.';
      }
    }
  }
  const a = areaKm2(pts);
  if (a < ZONE_LIMITS.minAreaKm2) return `Zone is too small (${a.toFixed(3)} km²).`;
  if (a > ZONE_LIMITS.maxAreaKm2) return `Zone is too large (${Math.round(a)} km²; max ${ZONE_LIMITS.maxAreaKm2}).`;
  return null;
}

/** Map path → GeoJSON coordinates [[[lng,lat]...]] (server closes + orients the ring). */
export function toGeoJson(pts: LatLng[]): number[][][] {
  return [pts.map((p) => [p.lng, p.lat])];
}

/** GeoJSON ring → map path (drops the closing vertex). */
export function fromGeoJson(coordinates: number[][][]): LatLng[] {
  const ring = coordinates[0] ?? [];
  const pts = ring.map(([lng, lat]) => ({ lat: lat!, lng: lng! }));
  const f = pts[0];
  const l = pts[pts.length - 1];
  if (pts.length > 1 && f && l && f.lat === l.lat && f.lng === l.lng) pts.pop();
  return pts;
}

/** Accepts "17.99, 79.55" or "17.99 79.55". */
export function parseLatLng(text: string): LatLng | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
