'use client';

/**
 * "Get My Location Code" — the receiver-side capture.
 *
 * A customer who is receiving a parcel often knows exactly where they are but
 * has no way to say it: there is no street address, and map search has no
 * record of their compound. This widget lets them fix a point and hand back a
 * short code plus a description of the place.
 *
 * Both halves matter. The code is what a dispatch system can act on; the
 * address is what a rider reads when they arrive.
 */

import { useState } from 'react';
import {
  getCurrentPosition,
  mapsSearchUrl,
  type CapturedPlace,
  type GeoError,
} from '@/lib/plusCode';

export default function LocationCodeWidget() {
  const [locating, setLocating] = useState(false);
  const [place, setPlace] = useState<CapturedPlace | null>(null);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCapture = async () => {
    setError(null);
    setCopied(false);
    setLocating(true);
    try {
      const captured = await getCurrentPosition();
      setPlace(captured);
    } catch (err) {
      setError((err as GeoError).friendly || 'We could not read your location.');
    } finally {
      setLocating(false);
    }
  };

  const handleCopy = async () => {
    if (!place) return;
    const text = address.trim()
      ? `${address.trim()} — ${place.plusCode} (${place.lat.toFixed(6)}, ${place.lng.toFixed(6)})`
      : `${place.plusCode} (${place.lat.toFixed(6)}, ${place.lng.toFixed(6)})`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleConfirm = () => {
    if (!place) return;
    window.open(mapsSearchUrl(place.lat, place.lng), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleCapture}
        disabled={locating}
        className="btn btn-outline btn-sm"
      >
        {locating ? 'Getting your location…' : 'Get My Location Code'}
      </button>

      {error && (
        <p className="text-[13px]" style={{ color: '#ffd9e2' }} role="alert">
          {error}
        </p>
      )}

      {place && (
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}
        >
          <p
            className="text-[11px] uppercase tracking-wide"
            style={{ color: 'rgba(255,255,255,0.72)' }}
          >
            Your location code
          </p>
          <p className="mt-0.5 font-mono text-[15px] font-bold tracking-wide text-white">
            {place.plusCode}
          </p>

          <label
            className="mt-2 block text-[11px] uppercase tracking-wide"
            style={{ color: 'rgba(255,255,255,0.72)' }}
          >
            Address of this place (send it to the sender)
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 14 Aggrey Road, beside the filling station"
            maxLength={200}
            className="mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
            }}
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
            >
              Confirm Coordinates
            </button>
          </div>

          <p className="mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.66)' }}>
            Send the code and the address to the person sending your parcel. Most
            places in Nigeria have no street address, so this is how the rider finds you.
          </p>
        </div>
      )}
    </div>
  );
}
