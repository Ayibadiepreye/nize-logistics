'use client';

/**
 * Map view — Leaflet + OpenStreetMap tiles.
 *
 * Replaces the Google Maps JavaScript SDK, whose data services are paywalled.
 * Leaflet and OSM tiles are free at any volume.
 *
 * Implementation note: this uses Leaflet directly rather than react-leaflet.
 * react-leaflet 4.x declares React 18 as a peer dependency while this app is on
 * React 19, so wrapping Leaflet by hand avoids a peer-dependency conflict that
 * would otherwise need a legacy-peer-deps flag on every install.
 *
 * Leaflet touches `window`, so it is imported inside an effect and the component
 * renders a placeholder until it has loaded.
 */

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * Expose the Leaflet instance for diagnostics.
 *
 * A ref would only be reachable from inside this component. Attaching it to the
 * window lets the running UI be inspected from outside — DevTools, or a test
 * driving the page over CDP — to answer "did the map actually move to the code
 * that was just entered?"
 */
if (typeof window !== 'undefined') {
  (window as unknown as { __nizeMap?: unknown }).__nizeMap = undefined;
}

export interface MapMarker {
  position: [number, number];
  popup?: string;
  icon?: 'pickup' | 'dropoff' | 'rider';
  /**
   * Whether this pin can be dragged. Defaults to true when the map is in
   * draggable mode, so a read-only marker (a rider's position, say) opts out
   * rather than every marker opting in.
   */
  draggable?: boolean;
}

export interface MapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  /** A route as an explicit list of [lat, lng] points. */
  route?: Array<[number, number]>;
  /** A GeoJSON LineString from the routing engine. Preferred over `route`. */
  routeGeometry?: { type: 'LineString'; coordinates: number[][] } | null;
  /** @deprecated Google's encoded polyline. Kept so old call sites still work. */
  routePolyline?: string;
  className?: string;
  showRouteInfo?: boolean;
  /** Called when the user clicks the map — used to drop a pin. */
  onMapClick?: (lat: number, lng: number) => void;
  /** Height in pixels. Defaults to 300. */
  height?: number;
  /** When true the map pans to `center` whenever it changes. */
  followCenter?: boolean;
  /**
   * Command the map to fly to a point.
   *
   * This is how an entered location code moves the view: the caller decodes the
   * code and passes the result here, so the map reacts to a pasted code rather
   * than only to a clicked pin. The `nonce` lets the same point be re-issued.
   */
  focusPoint?: { lat: number; lng: number; zoom?: number; nonce?: number } | null;
  /**
   * Let the caller drag the pins to nudge a placement.
   *
   * A captured code can land a few metres from the actual gate; dragging the pin
   * is how that gets corrected. The new coordinates come back through
   * `onMarkerMove`, which lets the caller re-derive the code and re-price.
   */
  draggableMarkers?: boolean;
  /** Called with the pin's previous position and its new one after a drag. */
  onMarkerMove?: (from: [number, number], to: { lat: number; lng: number }) => void;
  /**
   * A live position plotted alongside the markers — a rider's own GPS fix.
   * Shown read-only: it is a report, not a choice.
   */
  livePosition?: { lat: number; lng: number; label?: string } | null;
}

type LeafletModule = typeof import('leaflet');

/** Port Harcourt — the area this platform operates in. */
const DEFAULT_CENTER: [number, number] = [4.8156, 7.0498];

const ICON_COLORS = {
  pickup: '#0066ff',
  dropoff: '#ff3366',
  rider: '#10b981',
} as const;

type IconKind = keyof typeof ICON_COLORS;

/**
 * A pin drawn as an inline SVG data URI.
 *
 * Leaflet's own marker images resolve relative to its CSS file, which bundlers
 * mangle; an explicit data URI avoids a whole class of broken-image bugs and
 * needs no network request.
 */
function makePinIcon(L: LeafletModule, kind: IconKind) {
  const color = ICON_COLORS[kind] ?? ICON_COLORS.pickup;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
    <path d="M15 1C7.82 1 2 6.82 2 14c0 9.75 13 27 13 27s13-17.25 13-27C28 6.82 22.18 1 15 1z"
      fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="15" cy="14" r="5.5" fill="#ffffff"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: 'nize-pin',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  });
}

/** Decode Google's encoded polyline format, for backwards compatibility. */
function decodePolyline(str: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < str.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat * 1e-5, lng * 1e-5]);
  }
  return points;
}

/** Normalise the route inputs into a single list of points. */
function resolveRoutePoints(props: MapProps): Array<[number, number]> {
  if (props.routeGeometry?.coordinates?.length) {
    // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
    return props.routeGeometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );
  }
  if (props.route?.length) return props.route;
  if (props.routePolyline) {
    try {
      return decodePolyline(props.routePolyline);
    } catch {
      return [];
    }
  }
  return [];
}

export default function Map(props: MapProps) {
  const {
    center = DEFAULT_CENTER,
    zoom = 13,
    markers = [],
    className = '',
    showRouteInfo = false,
    onMapClick,
    height = 300,
    followCenter = false,
    focusPoint = null,
    draggableMarkers = false,
    onMarkerMove,
    livePosition = null,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const routeLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const markerLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const clickHandlerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  // Same trick for the drag callback: the Leaflet listener is bound once per
  // marker, so it must reach the current handler rather than the first one.
  const markerMoveRef = useRef<
    ((from: [number, number], to: { lat: number; lng: number }) => void) | null
  >(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  const routePoints = resolveRoutePoints(props);

  // Keep the latest click handler reachable from the Leaflet callback without
  // re-binding the listener on every render.
  useEffect(() => {
    clickHandlerRef.current = onMapClick ?? null;
  }, [onMapClick]);

  useEffect(() => {
    markerMoveRef.current = onMarkerMove ?? null;
  }, [onMarkerMove]);

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const L = await import('leaflet');
        if (cancelled || !containerRef.current || mapInstanceRef.current) return;

        leafletRef.current = L;

        const map = L.map(containerRef.current, {
          center,
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // OpenStreetMap's standard tile layer. Free to use; see their tile usage
        // policy for the fair-use limits that apply at high volume.
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        routeLayerRef.current = L.layerGroup().addTo(map);
        markerLayerRef.current = L.layerGroup().addTo(map);

        map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          clickHandlerRef.current?.(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
        setStatus('ready');
        // See the note at the top of this file.
        (window as unknown as { __nizeMap?: unknown }).__nizeMap = map;
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'unknown error');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      routeLayerRef.current = null;
      markerLayerRef.current = null;
      leafletRef.current = null;
    };
    // Deliberately initialised once; later prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers and the route when they change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || status !== 'ready') return;

    const markerLayer = markerLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!markerLayer || !routeLayer) return;

    markerLayer.clearLayers();
    routeLayer.clearLayers();

    // A plain object rather than `Map`: Leaflet's type declarations introduce a
    // `Map` class into this scope, which shadows the global constructor.
    const iconCache: Partial<Record<IconKind, ReturnType<typeof makePinIcon>>> = {};
    for (const m of markers) {
      const [lat, lng] = m.position;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const kind: IconKind = (m.icon as IconKind) ?? 'pickup';
      if (!iconCache[kind]) iconCache[kind] = makePinIcon(L, kind);

      const marker = L.marker(m.position, {
        icon: iconCache[kind]!,
        // Only the two endpoints are draggable — the route itself and a rider's
        // reported position are both read-only.
        draggable: draggableMarkers && m.draggable !== false,
      });
      if (m.popup) marker.bindPopup(m.popup);

      // Report the new position as the pin is moved, so the caller can re-derive
      // the code and re-price. `dragend` rather than `drag` avoids firing on
      // every pixel of the drag.
      if (draggableMarkers && m.draggable !== false) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          markerMoveRef.current?.(m.position, { lat: pos.lat, lng: pos.lng });
        });
      }

      marker.addTo(markerLayer);
    }

    // A live fix (a rider's own position). Never draggable, and deliberately kept
    // out of the framing bounds so the map does not jump every time it updates.
    if (livePosition && Number.isFinite(livePosition.lat) && Number.isFinite(livePosition.lng)) {
      if (!iconCache.rider) iconCache.rider = makePinIcon(L, 'rider');
      const live = L.marker([livePosition.lat, livePosition.lng], {
        icon: iconCache.rider!,
        draggable: false,
        zIndexOffset: 1000,
      });
      if (livePosition.label) live.bindPopup(livePosition.label);
      live.addTo(markerLayer);
    }

    if (routePoints.length > 1) {
      L.polyline(routePoints, {
        color: '#0066ff',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(routeLayer);
    }

    // Frame the content when there is more than one point to show.
    const allPoints: Array<[number, number]> = [
      ...markers.map((m) => m.position),
      ...routePoints,
    ];
    if (allPoints.length > 1) {
      map.fitBounds(allPoints, { padding: [30, 30], maxZoom: 15 });
    }
  }, [markers, routePoints, status, livePosition]);

  // Optionally follow a moving centre (a rider's position, for example).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || status !== 'ready' || !followCenter) return;
    map.setView(center, undefined, { animate: true });
  }, [center, followCenter, status]);

  // Fly to an explicitly requested point. Keyed on the whole object so a repeat
  // of the same coordinates still moves the view when the nonce changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || status !== 'ready' || !focusPoint) return;
    if (!Number.isFinite(focusPoint.lat) || !Number.isFinite(focusPoint.lng)) return;
    map.setView(
      [focusPoint.lat, focusPoint.lng],
      focusPoint.zoom ?? 16,
      { animate: true }
    );
  }, [focusPoint, status]);

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {showRouteInfo && status === 'ready' && (
        <div
          className="absolute top-3 left-3 px-3 py-2 rounded-xl text-xs font-bold shadow-lg"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            zIndex: 1000,
          }}
        >
          <span style={{ color: '#60a5fa' }}>OpenStreetMap</span>
          <span className="mx-1 opacity-50">•</span>
          <span style={{ color: '#4ade80' }}>Live routing</span>
        </div>
      )}

      {status === 'loading' && !loadError && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div className="text-center space-y-2">
            <div className="spinner mx-auto" style={{ width: '32px', height: '32px' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Loading map…
            </p>
          </div>
        </div>
      )}

      {loadError && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4 text-center"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div className="space-y-2 max-w-xs">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
              📍
            </div>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              Map unavailable
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Coordinates: {center[0].toFixed(4)}, {center[1].toFixed(4)}
            </p>
            {loadError && (
              <p className="text-[11px] opacity-70" style={{ color: 'var(--text-secondary)' }}>
                {loadError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
