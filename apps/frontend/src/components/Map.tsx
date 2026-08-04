'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    popup?: string;
    icon?: 'pickup' | 'dropoff' | 'rider';
  }>;
  route?: Array<[number, number]>;
  className?: string;
}

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createCustomIcon = (type: 'pickup' | 'dropoff' | 'rider') => {
  const colors = {
    pickup: '#1E5BBA',
    dropoff: '#E91E5C',
    rider: '#2A9D9F',
  };

  const html = `
    <div style="
      background: ${colors[type]};
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>
  `;

  return L.divIcon({
    html,
    className: 'custom-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
};

export default function Map({ center, zoom = 13, markers = [], route, className = '' }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(containerRef.current).setView(center, zoom);
    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers and routes
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Add markers
    markers.forEach((marker) => {
      const leafletMarker = L.marker(marker.position, {
        icon: marker.icon ? createCustomIcon(marker.icon) : undefined,
      }).addTo(map);

      if (marker.popup) {
        leafletMarker.bindPopup(marker.popup);
      }
    });

    // Add route if provided
    if (route && route.length > 0) {
      L.polyline(route, {
        color: '#1E5BBA',
        weight: 4,
        opacity: 0.7,
      }).addTo(map);
    }

    // Fit bounds to markers
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => m.position));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, markers, route]);

  return <div ref={containerRef} className={`map-container ${className}`} style={{ height: '100%', width: '100%' }} />;
}
