/**
 * Loads the Google Maps JavaScript API once (no npm loader package).
 * Uses the "prila-admin-web" key (website-restricted) + Map ID from .env.
 * Drawing Library and HeatmapLayer are NOT used (removed by Google, May 2026).
 */
const KEY = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? '';
export const MAP_ID = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) ?? '';

export function mapsConfigured(): boolean {
  return KEY.length > 0 && MAP_ID.length > 0;
}

let loading: Promise<void> | null = null;

declare global {
  interface Window {
    __prilaMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export class MapsLoadError extends Error {}

export function loadGoogleMaps(): Promise<void> {
  if (loading) return loading;
  if (!mapsConfigured()) {
    return Promise.reject(new MapsLoadError('Google Maps key / Map ID missing in admin .env'));
  }
  loading = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      loading = null;
      reject(new MapsLoadError('Google Maps took too long to load. Check your connection and retry.'));
    }, 15_000);
    window.__prilaMapsReady = () => {
      window.clearTimeout(timer);
      Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker')])
        .then(() => resolve())
        .catch(() => reject(new MapsLoadError('Google Maps libraries failed to load')));
    };
    // Google calls this when the key is rejected (wrong referrer, API not enabled, billing).
    window.gm_authFailure = () => {
      window.clearTimeout(timer);
      loading = null;
      reject(new MapsLoadError('Google rejected the Maps key for this site (check key restrictions / billing).'));
    };
    const params = new URLSearchParams({
      key: KEY,
      v: 'weekly',
      loading: 'async',
      callback: '__prilaMapsReady',
      language: 'en',
      region: 'IN',
    });
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => {
      window.clearTimeout(timer);
      loading = null;
      s.remove();
      reject(new MapsLoadError('Could not reach Google Maps. Check your connection and retry.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}
