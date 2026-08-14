'use client';

import { useEffect, useRef, useState } from 'react';

interface MapPreviewProps {
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  className?: string;
}

// Load Google Maps script
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.google !== 'undefined' && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (error) => reject(error);
    document.head.appendChild(script);
  });
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
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key is missing');
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        setIsLoaded(true);
        
        if (mapRef.current && !mapInstanceRef.current) {
          // Default center: Port Harcourt, Nigeria
          const center = { lat: 4.8156, lng: 7.0498 };
          
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

          directionsRendererRef.current = new google.maps.DirectionsRenderer({
            map: mapInstanceRef.current,
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: '#1E5BBA',
              strokeWeight: 4
            }
          });
        }
      })
      .catch(err => {
        console.error('Error loading Google Maps:', err);
      });
  }, []);

  // Update markers and route when coordinates change
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Add pickup marker
    if (pickupLat && pickupLng) {
      const pickupMarker = new google.maps.Marker({
        position: { lat: pickupLat, lng: pickupLng },
        map: mapInstanceRef.current,
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
        }
      });
      markersRef.current.push(pickupMarker);
      bounds.extend({ lat: pickupLat, lng: pickupLng });
      hasPoints = true;
    }

    // Add dropoff marker
    if (dropoffLat && dropoffLng) {
      const dropoffMarker = new google.maps.Marker({
        position: { lat: dropoffLat, lng: dropoffLng },
        map: mapInstanceRef.current,
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
        }
      });
      markersRef.current.push(dropoffMarker);
      bounds.extend({ lat: dropoffLat, lng: dropoffLng });
      hasPoints = true;
    }

    // Draw route if both points exist
    if (pickupLat && pickupLng && dropoffLat && dropoffLng && directionsRendererRef.current) {
      const directionsService = new google.maps.DirectionsService();
      
      directionsService.route(
        {
          origin: { lat: pickupLat, lng: pickupLng },
          destination: { lat: dropoffLat, lng: dropoffLng },
          travelMode: google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === 'OK' && result && directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(result);
          }
        }
      );
    } else if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
    }

    // Fit bounds
    if (hasPoints) {
      mapInstanceRef.current.fitBounds(bounds);
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
