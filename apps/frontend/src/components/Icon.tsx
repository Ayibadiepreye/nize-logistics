'use client';

import {
  BadgeCheck,
  Bike,
  Bolt,
  Box,
  Calculator,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Folder,
  HandCoins,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  PackageOpen,
  Phone,
  Rocket,
  Route,
  Search,
  ShoppingBag,
  Target,
  Truck,
  User,
  type LucideProps,
} from 'lucide-react';

/**
 * Icon set.
 *
 * These were previously Font Awesome glyphs pulled from a CDN stylesheet in
 * <head>. That was a render-blocking third-party request for icons we could
 * already draw with lucide-react (bundled for the dashboards), and every icon
 * on the site vanished whenever the CDN was slow or blocked. Mapping the names
 * here keeps the markup readable while removing the external dependency.
 */
const ICONS = {
  'truck-fast': Truck,
  phone: Phone,
  whatsapp: MessageCircle,
  rocket: Rocket,
  motorcycle: Bike,
  'info-circle': Info,
  'hand-holding-dollar': HandCoins,
  clock: Clock,
  'check-circle': CheckCircle2,
  calculator: Calculator,
  user: User,
  'shopping-bag': ShoppingBag,
  'search-location': Search,
  road: Route,
  'question-circle': Info,
  'map-marker-alt': MapPin,
  'location-arrow': Navigation,
  heart: Heart,
  folder: Folder,
  'file-alt': FileText,
  eye: Eye,
  'credit-card': CreditCard,
  'calendar-check': CalendarCheck,
  bullseye: Target,
  'box-open': PackageOpen,
  box: Package,
  bolt: Bolt,
  'chevron-down': ChevronDown,
  'badge-check': BadgeCheck,
  package: Package,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  const Component = ICONS[name] ?? Package;
  return <Component size={size} aria-hidden {...rest} />;
}

export default Icon;
