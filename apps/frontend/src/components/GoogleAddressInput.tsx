'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';

interface GoogleAddressInputProps {
  value: string;
  onChange: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  label?: string;
  showCurrentLocation?: boolean;
}

export default function GoogleAddressInput({
  value,
  onChange,
  placeholder = 'Enter address',
  label,
  showCurrentLocation = false
}: GoogleAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setIsLoaded(true);
        
        if (inputRef.current && !autocompleteRef.current) {
          // Initialize autocomplete focused on Nigeria
          const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: 'ng' },
            fields: ['formatted_address', 'geometry', 'name']
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            
            if (place.geometry?.location) {
              const address = place.formatted_address || place.name || '';
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              
              onChange(address, lat, lng);
            }
          });

          autocompleteRef.current = autocomplete;
        }
      })
      .catch(err => {
        console.error('Error loading Google Maps:', err);
      });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onChange]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (window.google?.maps) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            setIsGettingLocation(false);
            if (status === 'OK' && results?.[0]) {
              const address = results[0].formatted_address;
              onChange(address, lat, lng);
              if (inputRef.current) {
                inputRef.current.value = address;
              }
            } else {
              const addr = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
              onChange(addr, lat, lng);
              if (inputRef.current) {
                inputRef.current.value = addr;
              }
            }
          });
        } else {
          setIsGettingLocation(false);
          const addr = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
          onChange(addr, lat, lng);
          if (inputRef.current) {
            inputRef.current.value = addr;
          }
        }
      },
      (error) => {
        setIsGettingLocation(false);
        alert('Unable to get your location: ' + error.message);
      }
    );
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          disabled={!isLoaded}
        />
        {showCurrentLocation && isLoaded && (
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            title="Use current location"
          >
            {isGettingLocation ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {!isLoaded && (
        <p className="text-xs text-gray-500 mt-1">Loading Google Maps...</p>
      )}
    </div>
  );
}
