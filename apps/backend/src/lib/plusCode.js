import { OpenLocationCode } from 'open-location-code';

const olc = new OpenLocationCode();

/**
 * Plus Code (Open Location Code) helpers.
 *
 * Why Plus Codes instead of a Places API:
 *   - Nigeria has almost no usable street-address data. OpenStreetMap has no
 *     record of most businesses, and Google's geocoding APIs require a paid key.
 *   - A Plus Code is derived purely from a lat/lng pair, so it works anywhere on
 *     Earth with no lookup table, no network call, and no API key.
 *   - It gives us a stable, shareable identifier for a place that has no address.
 *
 * Code length and precision (approximate cell size):
 *    8 chars  -> ~37 m x 19 m   (neighbourhood)
 *   10 chars  -> ~14 m x 14 m   (building)      <- default
 *   11 chars  -> ~3.5 m x 3.5 m (room)
 */

export const PLUS_CODE_LENGTH = 10;
export const PLUS_CODE_PRECISION_M = 14;

/**
 * Encode a lat/lng pair into a full Plus Code.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [length] code length, defaults to PLUS_CODE_LENGTH
 * @returns {string} e.g. "6FP9R28X+6W"
 */
export function encodePlusCode(lat, lng, length = PLUS_CODE_LENGTH) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  try {
    return olc.encode(lat, lng, length);
  } catch {
    return null;
  }
}

/**
 * Decode a Plus Code back to a lat/lng centre point.
 * @param {string} code
 * @returns {{ lat: number, lng: number, length: number, valid: boolean }}
 */
export function decodePlusCode(code) {
  if (!code || typeof code !== 'string') {
    return { lat: null, lng: null, length: 0, valid: false };
  }
  const normalised = code.trim().toUpperCase();
  if (!olc.isValid(normalised)) {
    return { lat: null, lng: null, length: 0, valid: false };
  }
  try {
    const decoded = olc.decode(normalised);
    return {
      lat: decoded.latitudeCenter,
      lng: decoded.longitudeCenter,
      length: decoded.codeLength,
      valid: true,
    };
  } catch {
    return { lat: null, lng: null, length: 0, valid: false };
  }
}

/**
 * True when a string is a structurally valid full Plus Code.
 * @param {string} code
 */
export function isValidPlusCode(code) {
  if (!code || typeof code !== 'string') return false;
  const normalised = code.trim().toUpperCase();
  return olc.isValid(normalised) && olc.isFull(normalised);
}

/**
 * Shorten a Plus Code against a reference point so it is easier to read aloud
 * or write down. Only shortens when the reference point is close enough that the
 * code can be recovered unambiguously.
 *
 * @param {string} code full Plus Code
 * @param {number} refLat reference latitude (e.g. the city the order is in)
 * @param {number} refLng reference longitude
 * @returns {string} shortened code, or the original if it cannot be shortened
 */
export function shortenPlusCode(code, refLat, refLng) {
  if (!isValidPlusCode(code)) return code;
  try {
    const shortened = olc.shorten(code.toUpperCase(), refLat, refLng);
    // shorten() returns the original when the reference is too far away.
    return shortened || code;
  } catch {
    return code;
  }
}

/**
 * Recover a shortened Plus Code using the reference point it was shortened with.
 * @param {string} code
 * @param {number} refLat
 * @param {number} refLng
 * @returns {string|null}
 */
export function recoverPlusCode(code, refLat, refLng) {
  if (!code || !Number.isFinite(refLat) || !Number.isFinite(refLng)) return null;
  try {
    const recovered = olc.recoverNearest(code.toUpperCase(), refLat, refLng);
    return recovered || null;
  } catch {
    return null;
  }
}

/**
 * Great-circle distance in metres between two lat/lng pairs.
 * Used for the sanity check on routing results and for proximity sorting.
 */
export function haversineMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Distance in metres between the centres of two Plus Codes.
 * Returns null if either code is invalid.
 */
export function plusCodeDistanceMeters(codeA, codeB) {
  const a = decodePlusCode(codeA);
  const b = decodePlusCode(codeB);
  if (!a.valid || !b.valid) return null;
  return haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
}

/**
 * Build the plain Google Maps web link used for visual pin verification.
 * This is a normal web URL — no API key, no JavaScript SDK, no cost.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function mapsSearchUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Build a Google Maps directions link for a rider's handset.
 * Hands off to whatever map app the rider has installed.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function mapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
