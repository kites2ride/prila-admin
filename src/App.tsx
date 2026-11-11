import { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { getToken } from './lib/session';
import { getRoute, navigate, onRouteChange, type RouteId } from './lib/pathRouter';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { ConfigEditorPage } from './pages/ConfigEditorPage';
import { AppConfigPage } from './pages/AppConfigPage';
import { CitiesPage } from './pages/CitiesPage';
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

function renderPage(route: RouteId) {
  switch (route) {
    case 'overview':
      return <OverviewPage />;
    case 'app-config':
      return <AppConfigPage />;
    case 'matching':
      return (
        <ConfigEditorPage
          title="Matching (legacy)"
          configKey="matching"
          requireConfirm
          description="Used only when dispatch.enabled=false. Quote TTL still read from here."
        />
      );
    case 'dispatch':
      return (
        <ConfigEditorPage
          title="Dispatch"
          configKey="dispatch"
          requireConfirm
          description="H3 in-memory matching. Batch offer + first accept. Set enabled=false to roll back to $geoNear."
        />
      );
    case 'surge':
      return (
        <ConfigEditorPage
          title="Surge"
          configKey="surge"
          requireConfirm
          description="H3 demand/supply heatmap. Keep enabled=false until tuned. Multiplier snapshotted into quote."
        />
      );
    case 'pilot-quality':
      return (
        <ConfigEditorPage
          title="Pilot quality"
          configKey="pilot_quality"
          requireConfirm
          description="Min rating to go online, cancel-rate gates. Suspension is admin-actioned."
        />
      );
    case 'pilots':
      return <PilotsPage />;
    case 'payouts':
      return <PayoutsPage />;
    case 'home-promo':
      return (
        <ConfigEditorPage
          title="Home promo"
          configKey="home_promo"
          description="Banner on customer home when enabled. Apps read via bootstrap."
        />
      );
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
      return <ConfigEditorPage title="Support" configKey="support" description="Phone, WhatsApp, SOS, legal URLs." />;
    case 'maintenance':
      return (
        <ConfigEditorPage
          title="Maintenance"
          configKey="maintenance"
          requireConfirm
          description="Blocks apps when enabled (except fail-open rules)."
        />
      );
    case 'app-update':
      return (
        <ConfigEditorPage
          title="App update policy"
          configKey="app_update"
          description="minBuild / latestBuild / storeUrl per app × platform."
        />
      );
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
