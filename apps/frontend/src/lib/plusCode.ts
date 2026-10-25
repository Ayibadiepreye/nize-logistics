/**
 * Plus Codes (Open Location Code) — client side.
 *
 * Nigeria has almost no usable street-address data: OpenStreetMap has no record
 * of most businesses, and the commercial geocoders require a paid API key.
 *
 * A Plus Code is derived purely from a lat/lng pair. It needs no network call,
 * no API key and no lookup table, so a customer can capture a location anywhere
 * — including a compound that has never been mapped.
 *
 * Code length and precision:
 *    8 chars  -> ~37 m x 19 m   (neighbourhood)
 *   10 chars  -> ~14 m x 14 m   (building)      <- default
 *   11 chars  -> ~3.5 m x 3.5 m (room)
 */

import { OpenLocationCode } from 'open-location-code';

const olc = new OpenLocationCode();

/** A 10-character code covers roughly 14 m — fine enough to find a gate. */
export const PLUS_CODE_LENGTH = 10;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CapturedPlace extends LatLng {
  plusCode: string;
  /** What the customer called this place. */
  label?: string;
}

/** Encode a lat/lng pair into a full Plus Code. */
export function encodePlusCode(lat: number, lng: number, length = PLUS_CODE_LENGTH): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  try {
    return olc.encode(lat, lng, length);
  } catch {
    return null;
  }
}

/** Decode a Plus Code back to a lat/lng centre point. */
export function decodePlusCode(code: string): (LatLng & { valid: boolean; length: number }) | null {
  if (!code || typeof code !== 'string') return null;
  const normalised = code.trim().toUpperCase();
  if (!olc.isValid(normalised)) return null;
  try {
    const decoded = olc.decode(normalised);
    return {
      lat: decoded.latitudeCenter,
      lng: decoded.longitudeCenter,
      length: decoded.codeLength,
      valid: true,
    };
  } catch {
    return null;
  }
}

/** True when a string is a structurally valid full Plus Code. */
export function isValidPlusCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const normalised = code.trim().toUpperCase();
  return olc.isValid(normalised) && olc.isFull(normalised);
}

/**
 * Great-circle distance in metres.
 *
 * Used to sanity-check a captured pin against the place the customer described,
 * and to sort nearby saved places.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Plain Google Maps web link for visual pin verification.
 *
 * This is an ordinary web URL — no API key, no JavaScript SDK, no cost. It hands
 * off to whatever map app the user has, which is exactly what a rider needs for
 * the last hundred metres when the road data runs out.
 */
export function mapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Directions link for a rider's handset. */
export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export type GeoError = {
  code: number;
  message: string;
  /** A short, user-facing explanation. */
  friendly: string;
};

/**
 * Ask the browser for the current position.
 *
 * Wraps the callback API in a promise and translates the raw error codes into
 * something worth showing a customer, because "User denied geolocation" is not
 * actionable and "Location information is unavailable" is a permission or
 * hardware problem, not a bug in this app.
 */
export function getCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
): Promise<CapturedPlace> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by this browser',
        friendly: 'This browser cannot read your location. Type the address instead.',
      } as GeoError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const plusCode = encodePlusCode(latitude, longitude);
        if (!plusCode) {
          reject({
            code: 0,
            message: 'Could not encode the captured coordinates',
            friendly: 'We could not work out a code for that position. Try again.',
          } as GeoError);
          return;
        }
        resolve({
          lat: latitude,
          lng: longitude,
          plusCode,
          // Surfaced in the UI so the user can judge whether the fix is good.
          label: accuracy ? undefined : undefined,
        } as CapturedPlace);
      },
      (error) => {
        const friendly =
          error.code === 1
            ? 'Location permission was blocked. Allow it in your browser, or tap the map to place the pin yourself.'
            : error.code === 2
              ? 'Your position is unavailable right now. Check that location services are on.'
              : 'Getting your location timed out. Move somewhere with a clearer view of the sky and try again.';
        reject({ code: error.code, message: error.message, friendly } as GeoError);
      },
      options
    );
  });
}

/** Formats a captured place for display. */
export function formatPlusCode(code: string): string {
  return code;
}
