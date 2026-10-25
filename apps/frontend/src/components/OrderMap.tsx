'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="transform: rotate(45deg); color: white; font-size: 14px;">📍</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const pickupIcon = createCustomIcon('#0066ff');
const dropoffIcon = createCustomIcon('#ff3366');

interface MapUpdaterProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}

function MapUpdater({ pickupLat, pickupLng, dropoffLat, dropoffLng }: MapUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    // Fit map to show both markers
    const bounds = L.latLngBounds(
      [pickupLat, pickupLng],
      [dropoffLat, dropoffLng]
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, map]);

  return null;
}

interface OrderMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupAddress: string;
  dropoffAddress: string;
}

export default function OrderMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
}: OrderMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading map...</p>
      </div>
    );
  }

  const center: [number, number] = [
    (pickupLat + dropoffLat) / 2,
    (pickupLng + dropoffLng) / 2,
  ];

  // Create unique key based on coordinates to force remount when they change significantly
  const mapKey = `map-${pickupLat.toFixed(4)}-${pickupLng.toFixed(4)}-${dropoffLat.toFixed(4)}-${dropoffLng.toFixed(4)}`;

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Marker position={[pickupLat, pickupLng]} icon={pickupIcon}>
          <Popup>
            <strong>📦 Pickup Location</strong><br />
            {pickupAddress || `${pickupLat.toFixed(4)}, ${pickupLng.toFixed(4)}`}
          </Popup>
        </Marker>

        <Marker position={[dropoffLat, dropoffLng]} icon={dropoffIcon}>
          <Popup>
            <strong>🎯 Dropoff Location</strong><br />
            {dropoffAddress || `${dropoffLat.toFixed(4)}, ${dropoffLng.toFixed(4)}`}
          </Popup>
        </Marker>

        <MapUpdater
          pickupLat={pickupLat}
          pickupLng={pickupLng}
          dropoffLat={dropoffLat}
          dropoffLng={dropoffLng}
        />
      </MapContainer>
    </div>
  );
}
