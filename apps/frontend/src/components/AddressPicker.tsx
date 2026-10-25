'use client';

/**
 * Location capture for a pickup or drop-off point.
 *
 * This replaces the Google Places autocomplete, which needed a paid API key and
 * which — measured, not assumed — returns nothing for most Nigerian businesses.
 * OpenStreetMap has no record of them either.
 *
 * So the flow is coordinate-first:
 *   1. The customer taps "Get My Location Code" (or taps the map) to fix a point.
 *   2. That point is encoded locally into a Plus Code — no network call, no key.
 *   3. The customer names the place in their own words, because the rider needs
 *      "Blue Gate behind the pharmacy" far more than a coordinate.
 *   4. "Confirm Coordinates" opens the exact point in a map app so the customer
 *      can see it land on the right building before committing.
 *
 * The name and the code together are what make a delivery findable in a city
 * where most places have no street address.
 */

import { useState } from 'react';
import Map from '@/components/Map';
import {
  getCurrentPosition,
  encodePlusCode,
  mapsSearchUrl,
  type GeoError,
} from '@/lib/plusCode';

export interface PickedPoint {
  lat: number;
  lng: number;
  plusCode: string;
}

interface AddressPickerProps {
  title: string;
  /** Free-text description of the place, e.g. "14 Aggrey Road". */
  address: string;
  onAddressChange: (address: string) => void;
  /** The name the rider will read, e.g. "Blue Gate behind the pharmacy". */
  placeName: string;
  onPlaceNameChange: (name: string) => void;
  point: PickedPoint | null;
  onPointChange: (point: PickedPoint) => void;
  icon: 'pickup' | 'dropoff';
  /** Hint shown under the map. */
  hint?: string;
}

export default function AddressPicker({
  title,
  address,
  onAddressChange,
  placeName,
  onPlaceNameChange,
  point,
  onPointChange,
  icon,
  hint,
}: AddressPickerProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Read the device GPS and derive a code. */
  const handleGetLocation = async () => {
    setError(null);
    setNotice(null);
    setLocating(true);
    try {
      const captured = await getCurrentPosition();
      onPointChange({
        lat: captured.lat,
        lng: captured.lng,
        plusCode: captured.plusCode,
      });
      setNotice(`Location captured — code ${captured.plusCode}`);
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr.friendly || 'We could not read your location.');
    } finally {
      setLocating(false);
    }
  };

  /** Let the customer place the pin by hand, for when GPS is off or wrong. */
  const handleMapClick = (lat: number, lng: number) => {
    const plusCode = encodePlusCode(lat, lng);
    if (!plusCode) return;
    onPointChange({ lat, lng, plusCode });
    setError(null);
    setNotice(`Pin placed — code ${plusCode}`);
  };

  /** Open the exact point in a map app so the customer can verify it. */
  const handleConfirm = () => {
    if (!point) {
      setError('Capture your location first, or tap the map to place the pin.');
      return;
    }
    window.open(mapsSearchUrl(point.lat, point.lng), '_blank', 'noopener,noreferrer');
  };

  const accent = icon === 'pickup' ? '#0066ff' : '#ff3366';

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: accent }}
        />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
      </div>

      {/* The name the rider reads. */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Name this place
        </label>
        <input
          type="text"
          value={placeName}
          onChange={(e) => onPlaceNameChange(e.target.value)}
          placeholder="e.g. Blue Gate behind the pharmacy"
          maxLength={120}
          className="w-full px-3 py-2.5 rounded-lg border text-sm transition-colors"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          The rider reads this. Be specific — gate colour, landmark, floor.
        </p>
      </div>

      {/* Free-text description, kept because customers expect to type an address. */}
      <div>
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Address or directions
        </label>
        <textarea
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="e.g. 14 Aggrey Road, beside the filling station"
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none transition-colors"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Capture controls. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGetLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: accent }}
        >
          {locating ? (
            <span className="spinner" style={{ width: 12, height: 12 }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 21s-7-6.1-7-11a7 7 0 1114 0c0 4.9-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
          )}
          {locating ? 'Getting location…' : 'Get My Location Code'}
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
            background: 'var(--bg-primary)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 20l-5.5-2.5v-13L9 7l6-2.5L20.5 7v13L15 17.5 9 20z" />
            <path d="M9 7v13M15 4.5v13" />
          </svg>
          Confirm Coordinates
        </button>
      </div>

      {/* Status. */}
      {notice && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-mono"
          style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
        >
          {error}
        </div>
      )}

      {/* The map is the source of truth: the pin is the location. */}
      <Map
        center={point ? [point.lat, point.lng] : [4.8156, 7.0498]}
        zoom={point ? 16 : 13}
        height={260}
        onMapClick={handleMapClick}
        markers={
          point
            ? [
                {
                  position: [point.lat, point.lng],
                  icon,
                  popup: placeName || point.plusCode,
                },
              ]
            : []
        }
      />

      {point ? (
        <div
          className="rounded-lg px-3 py-2 text-xs flex items-center justify-between"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>
            {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </span>
          <span className="font-mono font-semibold" style={{ color: accent }}>
            {point.plusCode}
          </span>
        </div>
      ) : (
        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {hint ?? 'Tap the map to place a pin, or use the button above.'}
        </p>
      )}
    </div>
  );
}
