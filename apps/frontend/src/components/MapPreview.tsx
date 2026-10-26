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
  /** What the customer wrote for each place, shown on the pin. */
  pickupAddress?: string;
  dropoffAddress?: string;
  /** A GeoJSON LineString from the backend's routing engine, when available. */
  routeGeometry?: { type: 'LineString'; coordinates: number[][] } | null;
  /** Fly to this point — set when a location code is entered. */
  focusPoint?: { lat: number; lng: number; zoom?: number; nonce?: number } | null;
  /** Let the customer drag a pin to nudge it onto the right gate. */
  draggableMarkers?: boolean;
  onMarkerMove?: (from: [number, number], to: { lat: number; lng: number }) => void;
  /**
   * A live position to plot alongside the two endpoints — a rider's own GPS
   * fix, say. Never draggable: it is a report, not a choice.
   */
  livePosition?: { lat: number; lng: number; label?: string } | null;
  className?: string;
  height?: number;
}

export default function MapPreview({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress = '',
  dropoffAddress = '',
  routeGeometry = null,
  focusPoint = null,
  draggableMarkers = false,
  onMarkerMove,
  livePosition = null,
  className = '',
  height = 300,
}: MapPreviewProps) {
  const markers: Array<{
    position: [number, number];
    icon: 'pickup' | 'dropoff' | 'rider';
    popup: string;
    draggable?: boolean;
  }> = [];

  if (pickupLat && pickupLng && !Number.isNaN(pickupLat) && !Number.isNaN(pickupLng)) {
    markers.push({
      position: [pickupLat, pickupLng],
      icon: 'pickup',
      popup: pickupAddress || 'Pickup',
    });
  }
  if (dropoffLat && dropoffLng && !Number.isNaN(dropoffLat) && !Number.isNaN(dropoffLng)) {
    markers.push({
      position: [dropoffLat, dropoffLng],
      icon: 'dropoff',
      popup: dropoffAddress || 'Drop-off',
    });
  }

  // A rider's own position. Opted out of dragging explicitly, because it is a
  // GPS report rather than something the user is choosing.
  if (
    livePosition &&
    Number.isFinite(livePosition.lat) &&
    Number.isFinite(livePosition.lng)
  ) {
    markers.push({
      position: [livePosition.lat, livePosition.lng],
      icon: 'rider',
      popup: livePosition.label || 'You are here',
      draggable: false,
    });
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
      focusPoint={focusPoint}
      draggableMarkers={draggableMarkers}
      onMarkerMove={onMarkerMove}
      livePosition={livePosition}
      className={className}
      height={height}
      showRouteInfo={!!routeGeometry}
    />
  );
}
