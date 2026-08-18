'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface OrderMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  className?: string;
}

export default function OrderMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
  className = '',
}: OrderMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (mapRef.current && !mapInstanceRef.current && window.google?.maps) {
          const center = {
            lat: (!isNaN(pickupLat) && !isNaN(dropoffLat)) ? (pickupLat + dropoffLat) / 2 : 4.8156,
            lng: (!isNaN(pickupLng) && !isNaN(dropoffLng)) ? (pickupLng + dropoffLng) / 2 : 7.0498,
          };

          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }],
              },
            ],
          });

          setIsLoaded(true);
        }
      })
      .catch((err) => {
        console.warn('Google Maps loader note:', err);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Clear old line
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Pickup
    if (!isNaN(pickupLat) && !isNaN(pickupLng) && pickupLat !== 0 && pickupLng !== 0) {
      const pos = { lat: pickupLat, lng: pickupLng };
      const pickupMarker = new google.maps.Marker({
        position: pos,
        map,
        label: {
          text: 'A',
          color: '#ffffff',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#0066ff',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: pickupAddress || 'Pickup Location',
      });

      markersRef.current.push(pickupMarker);
      bounds.extend(pos);
      hasPoints = true;
    }

    // Dropoff
    if (!isNaN(dropoffLat) && !isNaN(dropoffLng) && dropoffLat !== 0 && dropoffLng !== 0) {
      const pos = { lat: dropoffLat, lng: dropoffLng };
      const dropoffMarker = new google.maps.Marker({
        position: pos,
        map,
        label: {
          text: 'B',
          color: '#ffffff',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#ff3366',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: dropoffAddress || 'Dropoff Location',
      });

      markersRef.current.push(dropoffMarker);
      bounds.extend(pos);
      hasPoints = true;
    }

    // Draw route line
    if (hasPoints && markersRef.current.length >= 2) {
      const path = [
        new google.maps.LatLng(pickupLat, pickupLng),
        new google.maps.LatLng(dropoffLat, dropoffLng),
      ];

      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#0066ff',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });

      map.fitBounds(bounds);
      google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 15) {
          map.setZoom(15);
        }
      });
    }
  }, [isLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return (
    <div className={`relative w-full h-full min-h-[300px] ${className}`} style={{ borderRadius: '16px', overflow: 'hidden' }}>
      <div ref={mapRef} className="w-full h-full min-h-[300px]" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-center space-y-2">
            <div className="spinner mx-auto" style={{ width: '32px', height: '32px' }}></div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading Google Maps...</p>
          </div>
        </div>
      )}
    </div>
  );
}
