'use client';

/**
 * One endpoint of a booking: the address and the location code.
 *
 * There is no map inside this component. Both endpoints are described here and
 * the single map beside the form is what shows them, so there is exactly one map
 * in the flow and it can draw the route between the two.
 *
 * The location code is the authoritative part. It is an editable field because
 * the two ends of a delivery are usually known by different people:
 *
 *   - Pickup: the sender is here, so they tap "Get My Location Code" and the
 *     field fills itself from the device GPS.
 *   - Drop-off: the receiver is elsewhere, so there is no GPS button. The
 *     receiver captures their own code and sends it, and the sender pastes it in.
 *
 * Typing or pasting a code anywhere decodes it locally and moves the map, so the
 * customer always sees where a code actually points before committing. A pin can
 * then be dragged to nudge it onto the right gate.
 */

import { useState } from 'react';
import {
  getCurrentPosition,
  decodePlusCode,
  isValidPlusCode,
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
  /** The Plus Code for this endpoint. */
  plusCode: string;
  onPlusCodeChange: (code: string) => void;
  point: PickedPoint | null;
  onPointChange: (point: PickedPoint) => void;
  icon: 'pickup' | 'dropoff';
  /**
   * Whether to offer "Get My Location Code".
   *
   * True for pickup (the sender is standing there). False for drop-off, where
   * the code has to come from the receiver.
   */
  allowGpsCapture?: boolean;
  hint?: string;
}

export default function AddressPicker({
  title,
  address,
  onAddressChange,
  plusCode,
  onPlusCodeChange,
  point,
  onPointChange,
  icon,
  allowGpsCapture = false,
  hint,
}: AddressPickerProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = icon === 'pickup' ? '#0066ff' : '#ff3366';

  /** Read the device GPS, derive a code, and fill the field from it. */
  const handleGetLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const captured = await getCurrentPosition();
      onPlusCodeChange(captured.plusCode);
      onPointChange({ lat: captured.lat, lng: captured.lng, plusCode: captured.plusCode });
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr.friendly || 'We could not read your location.');
    } finally {
      setLocating(false);
    }
  };

  /**
   * A code typed or pasted by hand.
   *
   * Decoding locally means the map can move to the point immediately, with no
   * round trip — and an invalid code is caught here rather than at the server.
   */
  const handleCodeChange = (raw: string) => {
    const cleaned = raw.trim().toUpperCase();
    onPlusCodeChange(cleaned);

    if (!cleaned) return;

    if (!isValidPlusCode(cleaned)) {
      // Not a complete code yet — the customer may still be typing.
      if (cleaned.length >= 8) setError('That does not look like a complete location code.');
      return;
    }

    const decoded = decodePlusCode(cleaned);
    if (decoded) {
      setError(null);
      onPointChange({ lat: decoded.lat, lng: decoded.lng, plusCode: cleaned });
    }
  };

  /** Open the point in a map app so the customer can verify it. */
  const handleConfirm = () => {
    if (!point) {
      setError('Enter a location code first.');
      return;
    }
    window.open(mapsSearchUrl(point.lat, point.lng), '_blank', 'noopener,noreferrer');
  };

  const inputStyle = {
    background: 'var(--bg-primary)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
      </div>

      {/* The written address. The rider reads this to recognise the place; the
          code is what actually places the pin. */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Address or directions *
        </label>
        <textarea
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="e.g. 14 Aggrey Road, beside the filling station"
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none transition-colors"
          style={inputStyle}
        />
      </div>

      {/* The location code — the part that actually places the pin. */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Location code *
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={plusCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="e.g. 6FP9R28X+6W"
            maxLength={16}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 min-w-[190px] px-3 py-2.5 rounded-lg border text-sm font-mono uppercase transition-colors"
            style={inputStyle}
          />

          {allowGpsCapture && (
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
          )}

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

        {allowGpsCapture ? (
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
            Tap the button to fill this from your GPS, or paste a code.
          </p>
        ) : (
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
            Ask the receiver to send you their location code, then paste it here.
          </p>
        )}
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
        >
          {error}
        </div>
      )}

      {/* The decoded position, shown so the customer can see the code resolved. */}
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
          {hint ?? 'Enter a location code and the map will move to it.'}
        </p>
      )}
    </div>
  );
}
