'use client';

/**
 * Read-only map preview of a pickup and drop-off pair.
 *
 * Thin wrapper around Map so the booking and quotes pages get a consistent view
 * without each one owning map lifecycle code.
 *
 * The route line here is a straight line between the two points unless the
 * caller passes `routeGeometry` from the backend's routing engine. That is
 * deliberate: the preview is drawn before the order exists, so there is no
 * server-computed route yet.
 */

import Map from '@/components/Map';

interface MapPreviewProps {
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  /** A GeoJSON LineString from the backend's routing engine, when available. */
  routeGeometry?: { type: 'LineString'; coordinates: number[][] } | null;
  className?: string;
  height?: number;
}

export default function MapPreview({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  routeGeometry = null,
  className = '',
  height = 300,
}: MapPreviewProps) {
  const markers: Array<{ position: [number, number]; icon: 'pickup' | 'dropoff'; popup: string }> = [];

  if (pickupLat && pickupLng && !Number.isNaN(pickupLat) && !Number.isNaN(pickupLng)) {
    markers.push({ position: [pickupLat, pickupLng], icon: 'pickup', popup: 'Pickup' });
  }
  if (dropoffLat && dropoffLng && !Number.isNaN(dropoffLat) && !Number.isNaN(dropoffLng)) {
    markers.push({ position: [dropoffLat, dropoffLng], icon: 'dropoff', popup: 'Drop-off' });
  }

  return (
    <Map
      center={
        pickupLat && pickupLng
          ? [pickupLat, pickupLng]
          : dropoffLat && dropoffLng
            ? [dropoffLat, dropoffLng]
            : [4.8156, 7.0498]
      }
      zoom={13}
      markers={markers}
      routeGeometry={routeGeometry}
      className={className}
      height={height}
      showRouteInfo={!!routeGeometry}
    />
  );
}
