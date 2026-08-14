'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface GoogleAddressInputProps {
  value: string;
  onChange: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
  label?: string;
}

export default function GoogleAddressInput({
  value,
  onChange,
  placeholder = 'Enter address',
  label
}: GoogleAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      version: 'weekly',
      libraries: ['places']
    });

    loader.load().then(() => {
      setIsLoaded(true);
      
      if (inputRef.current) {
        // Initialize autocomplete focused on Nigeria
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'ng' }, // Restrict to Nigeria
          fields: ['formatted_address', 'geometry', 'name']
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (place.geometry && place.geometry.location) {
            const address = place.formatted_address || place.name || '';
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            
            onChange(address, lat, lng);
          }
        });

        autocompleteRef.current = autocomplete;
      }
    }).catch(err => {
      console.error('Error loading Google Maps:', err);
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onChange]);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          // Update value but don't trigger onChange until place is selected
          if (inputRef.current) {
            inputRef.current.value = e.target.value;
          }
        }}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        disabled={!isLoaded}
      />
      {!isLoaded && (
        <p className="text-xs text-gray-500 mt-1">Loading Google Maps...</p>
      )}
    </div>
  );
}
