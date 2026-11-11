export type RouteId =
  | 'overview'
  | 'app-config'
  | 'matching'
  | 'support'
  | 'maintenance'
  | 'app-update'
  | 'cities'
  | 'services-fares'
  | 'rides'
  | 'dispatch'
  | 'surge'
  | 'pilot-quality'
  | 'pilots'
  | 'payouts'
  | 'home-promo'
  | 'push'
  | 'reports'
  | 'analytics'
  | 'nudges'
  | 'sos'
  | 'audit'
  | 'login';

const ROUTES: RouteId[] = [
  'overview',
  'app-config',
  'matching',
  'dispatch',
  'surge',
  'pilot-quality',
  'pilots',
  'payouts',
  'home-promo',
  'push',
  'reports',
  'analytics',
  'nudges',
  'sos',
  'support',
  'maintenance',
  'app-update',
  'cities',
  'services-fares',
  'rides',
  'audit',
  'login',
];

export function getRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, '') || 'overview';
  const id = hash.split('?')[0] as RouteId;
  return ROUTES.includes(id) ? id : 'overview';
}

export function navigate(route: RouteId): void {
  window.location.hash = `#/${route}`;
}

export function onRouteChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
