'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface MapProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    popup?: string;
    icon?: 'pickup' | 'dropoff' | 'rider';
  }>;
  route?: Array<[number, number]>;
  className?: string;
}

export default function GoogleMap({
  center = [4.8156, 7.0498],
  zoom = 13,
  markers = [],
  route,
  className = '',
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (mapRef.current && !mapInstanceRef.current && window.google?.maps) {
          const mapCenter = { lat: center[0], lng: center[1] };

          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center: mapCenter,
            zoom: zoom,
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
        setLoadError(err.message || 'Google Maps key not found');
      });
  }, []);

  // Update markers and route polyline whenever coordinates change
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    const map = mapInstanceRef.current;

    // Clear old markers
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Add each marker
    markers.forEach((markerData) => {
      const [lat, lng] = markerData.position;
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      const iconType = markerData.icon || 'pickup';

      let markerIcon: google.maps.Symbol | undefined;

      if (iconType === 'pickup') {
        markerIcon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#0066ff',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        };
      } else if (iconType === 'dropoff') {
        markerIcon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ff3366',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        };
      } else if (iconType === 'rider') {
        markerIcon = {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        };
      }

      const marker = new google.maps.Marker({
        position,
        map,
        icon: markerIcon,
        title: markerData.popup ? markerData.popup.replace(/<[^>]*>/g, '') : undefined,
      });

      if (markerData.popup) {
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-family: sans-serif; font-size: 12px; color: #1e293b; padding: 4px;">${markerData.popup}</div>`,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }

      googleMarkersRef.current.push(marker);
      bounds.extend(position);
      hasPoints = true;
    });

    // Draw route polyline if coordinates available
    if (route && route.length > 1) {
      const path = route.map(([lat, lng]) => new google.maps.LatLng(lat, lng));
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#0066ff',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });
    } else if (markers.length >= 2) {
      // Connect markers automatically
      const validMarkers = markers.filter((m) => !isNaN(m.position[0]) && !isNaN(m.position[1]));
      if (validMarkers.length >= 2) {
        const path = validMarkers.map((m) => new google.maps.LatLng(m.position[0], m.position[1]));
        polylineRef.current = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#0066ff',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });
      }
    }

    if (hasPoints) {
      map.fitBounds(bounds);
      google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15);
        }
      });
    }
  }, [isLoaded, markers, route]);

  return (
    <div className={`relative w-full h-full min-h-[300px] ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-2xl" style={{ minHeight: '300px' }} />
      {!isLoaded && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-center space-y-2">
            <div className="spinner mx-auto" style={{ width: '32px', height: '32px' }}></div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading Google Maps...</p>
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center p-4 rounded-2xl text-center" style={{ background: 'var(--bg-secondary)' }}>
          <div className="space-y-2 max-w-xs">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
              📍
            </div>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Google Maps Live Feed</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Port Harcourt Coordinates: {center[0].toFixed(4)}, {center[1].toFixed(4)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
