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
  riderLat?: number;
  riderLng?: number;
  riderName?: string;
  routePolyline?: string; // Encoded polyline from backend
  className?: string;
}

export default function OrderMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
  riderLat,
  riderLng,
  riderName,
  routePolyline,
  className = '',
}: OrderMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const riderMarkerRef = useRef<google.maps.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

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

  // Update pickup/dropoff markers and route
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    const map = mapInstanceRef.current;

    // Clear old markers (not rider)
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Clear old route
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Pickup marker
    if (!isNaN(pickupLat) && !isNaN(pickupLng) && pickupLat !== 0 && pickupLng !== 0) {
      const pos = { lat: pickupLat, lng: pickupLng };
      const pickupMarker = new google.maps.Marker({
        position: pos,
        map,
        label: { text: 'A', color: '#ffffff', fontWeight: 'bold' },
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

    // Dropoff marker
    if (!isNaN(dropoffLat) && !isNaN(dropoffLng) && dropoffLat !== 0 && dropoffLng !== 0) {
      const pos = { lat: dropoffLat, lng: dropoffLng };
      const dropoffMarker = new google.maps.Marker({
        position: pos,
        map,
        label: { text: 'B', color: '#ffffff', fontWeight: 'bold' },
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

    // Draw route using encoded polyline from API if available
    if (routePolyline) {
      try {
        const decodedPath = google.maps.geometry?.encoding?.decodePath(routePolyline);
        if (decodedPath && decodedPath.length > 0) {
          polylineRef.current = new google.maps.Polyline({
            path: decodedPath,
            geodesic: true,
            strokeColor: '#0066ff',
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map,
          });
          decodedPath.forEach((point) => bounds.extend(point));
        }
      } catch (err) {
        // Fall through to Directions Service
      }
    }

    // Use Directions Service for road-following route if no encoded polyline
    if (!routePolyline && hasPoints && markersRef.current.length >= 2) {
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#0066ff',
          strokeOpacity: 0.85,
          strokeWeight: 5,
        },
      });

      directionsService.route(
        {
          origin: { lat: pickupLat, lng: pickupLng },
          destination: { lat: dropoffLat, lng: dropoffLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result);
            directionsRendererRef.current = directionsRenderer;

            const leg = result.routes?.[0]?.legs?.[0];
            if (leg) {
              setRouteInfo({
                distance: leg.distance?.text || '',
                duration: leg.duration?.text || '',
              });
            }
          } else {
            // Fallback: straight line
            polylineRef.current = new google.maps.Polyline({
              path: [
                new google.maps.LatLng(pickupLat, pickupLng),
                new google.maps.LatLng(dropoffLat, dropoffLng),
              ],
              geodesic: true,
              strokeColor: '#0066ff',
              strokeOpacity: 0.85,
              strokeWeight: 4,
              map,
            });
          }
        }
      );
    }

    if (hasPoints) {
      map.fitBounds(bounds);
      google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 15) {
          map.setZoom(15);
        }
      });
    }
  }, [isLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng, routePolyline]);

  // Update rider marker separately (smooth animation)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    const map = mapInstanceRef.current;

    if (riderLat && riderLng && !isNaN(riderLat) && !isNaN(riderLng)) {
      const riderPos = { lat: riderLat, lng: riderLng };

      if (riderMarkerRef.current) {
        // Smoothly animate to new position
        riderMarkerRef.current.setPosition(riderPos);
      } else {
        // Create rider marker
        riderMarkerRef.current = new google.maps.Marker({
          position: riderPos,
          map,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 7,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: riderName || 'Rider',
          zIndex: 1000,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-family: sans-serif; font-size: 12px; color: #1e293b; padding: 4px;"><b>🛵 ${riderName || 'Rider'}</b><br/>Live Location</div>`,
        });

        riderMarkerRef.current.addListener('click', () => {
          infoWindow.open(map, riderMarkerRef.current!);
        });
      }
    } else if (riderMarkerRef.current) {
      riderMarkerRef.current.setMap(null);
      riderMarkerRef.current = null;
    }
  }, [isLoaded, riderLat, riderLng, riderName]);

  return (
    <div className={`relative w-full h-full min-h-[300px] ${className}`} style={{ borderRadius: '16px', overflow: 'hidden' }}>
      <div ref={mapRef} className="w-full h-full min-h-[300px]" />

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
