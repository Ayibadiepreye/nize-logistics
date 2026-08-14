'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface MapPreviewProps {
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  className?: string;
}

export default function MapPreview({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  className = ''
}: MapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map once
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (mapRef.current && !mapInstanceRef.current) {
          const center = { lat: 4.8156, lng: 7.0498 }; // Port Harcourt
          
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center,
            zoom: 12,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ]
          });
          
          setIsLoaded(true);
        }
      })
      .catch(err => {
        console.error('Error loading Google Maps:', err);
      });
  }, []);

  // Update markers when coordinates change
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    markersRef.current = [];
    
    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let hasValidPoints = false;

    // Add pickup marker
    if (pickupLat && pickupLng && !isNaN(pickupLat) && !isNaN(pickupLng)) {
      const pickupMarker = new google.maps.Marker({
        position: { lat: pickupLat, lng: pickupLng },
        map: map,
        label: {
          text: 'A',
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: 'Pickup Location'
      });
      
      markersRef.current.push(pickupMarker);
      bounds.extend(new google.maps.LatLng(pickupLat, pickupLng));
      hasValidPoints = true;
    }

    // Add dropoff marker
    if (dropoffLat && dropoffLng && !isNaN(dropoffLat) && !isNaN(dropoffLng)) {
      const dropoffMarker = new google.maps.Marker({
        position: { lat: dropoffLat, lng: dropoffLng },
        map: map,
        label: {
          text: 'B',
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#E91E5C',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: 'Dropoff Location'
      });
      
      markersRef.current.push(dropoffMarker);
      bounds.extend(new google.maps.LatLng(dropoffLat, dropoffLng));
      hasValidPoints = true;
    }

    // Draw line between points
    if (
      pickupLat && pickupLng && dropoffLat && dropoffLng &&
      !isNaN(pickupLat) && !isNaN(pickupLng) && !isNaN(dropoffLat) && !isNaN(dropoffLng)
    ) {
      const path = [
        new google.maps.LatLng(pickupLat, pickupLng),
        new google.maps.LatLng(dropoffLat, dropoffLng)
      ];
      
      polylineRef.current = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#1E5BBA',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: map
      });
    }

    // Fit bounds if we have points
    if (hasValidPoints) {
      map.fitBounds(bounds);
      
      // Ensure reasonable zoom level
      google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 15) {
          map.setZoom(15);
        }
      });
    }
  }, [isLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg"
        style={{ minHeight: '300px' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
