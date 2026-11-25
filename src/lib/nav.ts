import type { ComponentType } from 'react';
import {
  Bell, BellRing, Bike, Building2, Flame, FileText, Gauge, Hexagon, IndianRupee, Landmark, LayoutDashboard,
  LifeBuoy, ListChecks, Map, MapPinned, Megaphone, Radio, Receipt, Route, ScrollText, ShieldCheck, Siren,
  SlidersHorizontal, Smartphone, BarChart3, Wallet, Wrench,
} from 'lucide-react';
import type { RouteId } from './pathRouter';

export type NavIcon = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean; className?: string }>;

export const NAV_ICONS: Record<string, NavIcon> = {
  overview: LayoutDashboard, 'live-map': Map, rides: Route, kyc: ShieldCheck, sos: Siren, support: LifeBuoy,
  pilots: Bike, 'pilot-quality': Gauge, payouts: Wallet, 'services-fares': IndianRupee,
  analytics: BarChart3, reports: FileText, surge: Flame, maps: Receipt, 'home-promo': Megaphone, push: Bell, nudges: BellRing,
  'app-config': SlidersHorizontal, dispatch: Radio, cities: Building2, zones: MapPinned, 'zone-rules': ListChecks,
  landmarks: Landmark, maintenance: Wrench, 'app-update': Smartphone, audit: ScrollText,
};
export const iconFor = (id: RouteId) => NAV_ICONS[id] ?? Hexagon;

export const NAV_GROUPS: { label: string; items: { id: RouteId; label: string }[] }[] = [
  {
    label: 'Operations',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'live-map', label: 'Live map' },
      { id: 'rides', label: 'Rides' },
      { id: 'kyc', label: 'KYC review' },
      { id: 'sos', label: 'SOS' },
      { id: 'support', label: 'Support' },
    ],
  },
  {
    label: 'Pilots & money',
    items: [
      { id: 'pilots', label: 'Pilots' },
      { id: 'pilot-quality', label: 'Pilot quality' },
      { id: 'payouts', label: 'Payouts' },
      { id: 'services-fares', label: 'Services & fares' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { id: 'analytics', label: 'Analytics' },
      { id: 'reports', label: 'Reports' },
      { id: 'surge', label: 'Surge heatmap' },
      { id: 'maps', label: 'Maps (cost)' },
      { id: 'home-promo', label: 'Home promo' },
      { id: 'push', label: 'Push' },
      { id: 'nudges', label: 'Nudges' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'app-config', label: 'App config' },
      { id: 'dispatch', label: 'Dispatch' },
      { id: 'cities', label: 'Cities' },
      { id: 'zones', label: 'Zones (map)' },
      { id: 'zone-rules', label: 'Zone rules' },
      { id: 'landmarks', label: 'Landmarks' },
      { id: 'maintenance', label: 'Maintenance' },
      { id: 'app-update', label: 'App update' },
    ],
  },
  { label: 'Security', items: [{ id: 'audit', label: 'Audit log' }] },
];
