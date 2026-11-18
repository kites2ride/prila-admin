import { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { getToken } from './lib/session';
import { getRoute, navigate, onRouteChange, type RouteId } from './lib/pathRouter';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { AppConfigPage } from './pages/AppConfigPage';
import { CitiesPage } from './pages/CitiesPage';
import { ZonesPage } from './pages/ZonesPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { KycReviewPage } from './pages/KycReviewPage';
import { LandmarksPage } from './pages/LandmarksPage';
import { ServicesFaresPage } from './pages/ServicesFaresPage';
import { AuditPage } from './pages/AuditPage';
import { RidesPage } from './pages/RidesPage';
import { PayoutsPage } from './pages/PayoutsPage';
import { PilotsPage } from './pages/PilotsPage';
import { PushPage } from './pages/PushPage';
import { ReportsPage } from './pages/ReportsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NudgesPage } from './pages/NudgesPage';
import { SosPage } from './pages/SosPage';
import { HomePromoPage } from './pages/HomePromoPage';
import { SettingsConfigPage } from './pages/SettingsConfigPage';
import { AppUpdatePage } from './pages/AppUpdatePage';

const dispatchCrossChecks = (v: Record<string, string>): Record<string, string> =>
  Number(v.offerTimeoutSec) >= Number(v.maxSearchSec)
    ? { maxSearchSec: 'Must be longer than the offer timeout' }
    : {};

const maintenanceConfirm = {
  when: (before: Record<string, string>, after: Record<string, string>) =>
    before.enabled !== 'true' && after.enabled === 'true',
  phrase: 'MAINTENANCE',
  note: 'This blocks the customer and pilot apps for everyone until you turn it off.',
};

function renderPage(route: RouteId) {
  switch (route) {
    case 'overview':
      return <OverviewPage />;
    case 'app-config':
      return <AppConfigPage />;
    case 'dispatch':
      return (
        <SettingsConfigPage
          title="Dispatch"
          configKey="dispatch"
          description="How Prila finds and offers rides to nearby pilots. Start values — tune with real data."
          banner="Live matching logic. A bad value can leave riders without pilots. Turning the engine off rolls back to the legacy search."
          crossChecks={dispatchCrossChecks}
        />
      );
    case 'surge':
      return (
        <SettingsConfigPage
          title="Surge"
          configKey="surge"
          description="Demand / supply heatmap that can raise fares. Multiplier is snapshotted into the quote at estimate time."
          banner="Changes fares riders pay. Keep surge off until tuned."
        />
      );
    case 'live-map':
      return <LiveMapPage />;
    case 'kyc':
      return <KycReviewPage />;
    case 'zones':
      return <ZonesPage />;
    case 'landmarks':
      return <LandmarksPage />;
    case 'zone-rules':
      return (
        <SettingsConfigPage
          title="Zone rules"
          configKey="zones"
          description="Service-area enforcement and the messages riders and pilots see when outside it. Draw the zones themselves on Zones (map)."
          banner="Enforcement decides who can book and who can go online. With no enabled service zone, enforcement is skipped automatically."
        />
      );
    case 'maps':
      return (
        <SettingsConfigPage
          title="Maps (Google cost controls)"
          configKey="maps"
          description="Server-side Google Places / Routes / Geocoding. Defaults are the cheapest safe settings."
          banner="Turning Google off stops address search and falls back to straight-line fares. Live usage: GET /admin/maps/usage."
        />
      );
    case 'pilot-quality':
      return (
        <SettingsConfigPage
          title="Pilot quality"
          configKey="pilot_quality"
          description="Rating and cancel-rate gates for pilots going online. Suspension is an admin action unless auto-suspend is on."
        />
      );
    case 'pilots':
      return <PilotsPage />;
    case 'payouts':
      return <PayoutsPage />;
    case 'home-promo':
      return <HomePromoPage />;
    case 'push':
      return <PushPage />;
    case 'reports':
      return <ReportsPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'nudges':
      return <NudgesPage />;
    case 'sos':
      return <SosPage />;
    case 'support':
      return (
        <SettingsConfigPage
          title="Support"
          configKey="support"
          description="Contact details, emergency numbers and legal links shown in the apps."
        />
      );
    case 'maintenance':
      return (
        <SettingsConfigPage
          title="Maintenance"
          configKey="maintenance"
          description="Show a maintenance screen in the customer and pilot apps."
          banner="Turning this on blocks app use for everyone, including riders waiting for a pilot. Check there are no active rides first."
          strongConfirm={maintenanceConfirm}
        />
      );
    case 'app-update':
      return <AppUpdatePage />;
    case 'cities':
      return <CitiesPage />;
    case 'services-fares':
      return <ServicesFaresPage />;
    case 'rides':
      return <RidesPage />;
    case 'audit':
      return <AuditPage />;
    default:
      return <OverviewPage />;
  }
}

export function App() {
  const [route, setRoute] = useState<RouteId>(getRoute());
  const authed = Boolean(getToken());

  useEffect(() => onRouteChange(() => setRoute(getRoute())), []);

  useEffect(() => {
    if (!authed && route !== 'login') navigate('login');
    if (authed && route === 'login') navigate('overview');
  }, [authed, route]);

  if (!authed || route === 'login') {
    return <LoginPage />;
  }

  return <Shell route={route}>{renderPage(route)}</Shell>;
}
