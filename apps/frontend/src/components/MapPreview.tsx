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
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // Initialize map once
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (mapRef.current && !mapInstanceRef.current) {
          const center = { lat: 4.8156, lng: 7.0498 }; // Port Harcourt
          
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center,
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
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

  // Update markers and route when coordinates change
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

    // Clear existing directions
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    setRouteInfo(null);

    const bounds = new google.maps.LatLngBounds();
    let hasValidPoints = false;
    const hasPickup = pickupLat && pickupLng && !isNaN(pickupLat) && !isNaN(pickupLng);
    const hasDropoff = dropoffLat && dropoffLng && !isNaN(dropoffLat) && !isNaN(dropoffLng);

    // Add pickup marker
    if (hasPickup) {
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
    if (hasDropoff) {
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

    // Use Directions Service for road-following route
    if (hasPickup && hasDropoff) {
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // We draw our own markers
        polylineOptions: {
          strokeColor: '#1E5BBA',
          strokeOpacity: 0.85,
          strokeWeight: 4,
        },
      });

      directionsService.route(
        {
          origin: { lat: pickupLat!, lng: pickupLng! },
          destination: { lat: dropoffLat!, lng: dropoffLng! },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result);
            directionsRendererRef.current = directionsRenderer;

            // Extract route info
            const leg = result.routes?.[0]?.legs?.[0];
            if (leg) {
              setRouteInfo({
                distance: leg.distance?.text || '',
                duration: leg.duration?.text || '',
              });
            }
          } else {
            // Fallback: straight line
            const path = [
              new google.maps.LatLng(pickupLat!, pickupLng!),
              new google.maps.LatLng(dropoffLat!, dropoffLng!)
            ];
            
            polylineRef.current = new google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: '#1E5BBA',
              strokeOpacity: 0.8,
              strokeWeight: 3,
              map
            });
          }
        }
      );
    }

    // Fit bounds if we have points
    if (hasValidPoints) {
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
    <div className={`relative ${className}`}>
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg"
        style={{ minHeight: '300px' }}
      />

      {/* Route info overlay */}
      {routeInfo && (
        <div
          className="absolute top-3 left-3 px-3 py-2 rounded-xl text-xs font-bold shadow-lg"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
          }}
        >
          <span style={{ color: '#60a5fa' }}>{routeInfo.distance}</span>
          <span className="mx-1" style={{ opacity: 0.5 }}>•</span>
          <span style={{ color: '#34d399' }}>{routeInfo.duration}</span>
        </div>
      )}

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
