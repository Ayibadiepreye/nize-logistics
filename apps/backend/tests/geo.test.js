import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodePlusCode,
  decodePlusCode,
  isValidPlusCode,
  shortenPlusCode,
  recoverPlusCode,
  haversineMeters,
  plusCodeDistanceMeters,
  mapsSearchUrl,
} from '../src/lib/plusCode.js';
import { isPlausible, straightLineKm } from '../src/lib/routing.js';

/**
 * The coordinate-first addressing layer.
 *
 * These tests are the reason the platform can stop depending on a geocoding
 * API: if a Plus Code does not round-trip to within a few metres, the whole
 * approach is wrong and a rider gets sent to the wrong gate.
 */

// Real places, so the assertions are about the world rather than a fixture.
const PORT_HARCOURT = { lat: 4.8156, lng: 7.0498 };
const LEKKI = { lat: 6.4365, lng: 3.4513 };
const ISIOKPO = { lat: 4.97, lng: 7.0 };

test('a Plus Code round-trips to within its cell size', () => {
  const code = encodePlusCode(PORT_HARCOURT.lat, PORT_HARCOURT.lng, 10);
  const decoded = decodePlusCode(code);

  assert.equal(decoded.valid, true, 'the code we just encoded must decode');
  assert.equal(decoded.length, 10);

  // A 10-character code covers roughly 14 m. Allow generous headroom for the
  // cell centre being off the exact input point.
  const errorMeters = haversineMeters(
    { lat: decoded.lat, lng: decoded.lng },
    PORT_HARCOURT
  );
  assert.ok(
    errorMeters < 30,
    `decoded point was ${errorMeters.toFixed(1)} m from the original, expected < 30 m`
  );
});

test('a longer code is more precise than a shorter one', () => {
  const shortCode = encodePlusCode(PORT_HARCOURT.lat, PORT_HARCOURT.lng, 8);
  const longCode = encodePlusCode(PORT_HARCOURT.lat, PORT_HARCOURT.lng, 11);

  const shortError = haversineMeters(decodePlusCode(shortCode), PORT_HARCOURT);
  const longError = haversineMeters(decodePlusCode(longCode), PORT_HARCOURT);

  assert.ok(
    longError < shortError,
    `11-char error (${longError.toFixed(1)} m) should beat 8-char (${shortError.toFixed(1)} m)`
  );
  assert.ok(longError < 5, `11-char code should be within 5 m, got ${longError.toFixed(1)} m`);
});

test('encoding is deterministic', () => {
  assert.equal(
    encodePlusCode(LEKKI.lat, LEKKI.lng, 10),
    encodePlusCode(LEKKI.lat, LEKKI.lng, 10)
  );
});

test('different places get different codes', () => {
  const a = encodePlusCode(PORT_HARCOURT.lat, PORT_HARCOURT.lng, 10);
  const b = encodePlusCode(LEKKI.lat, LEKKI.lng, 10);
  assert.notEqual(a, b);
});

test('the code contains only characters from the Plus Code alphabet', () => {
  const code = encodePlusCode(PORT_HARCOURT.lat, PORT_HARCOURT.lng, 10);
  // A 10-character code renders as 8 characters, a '+' separator, then 2 more.
  // The alphabet deliberately excludes 0, 1, A, B, I and O so a code read out
  // loud or copied by hand cannot be misread.
  assert.match(code, /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
});

test('garbage is rejected rather than decoded to somewhere random', () => {
  assert.equal(isValidPlusCode('not-a-code'), false);
  assert.equal(isValidPlusCode(''), false);
  assert.equal(isValidPlusCode(null), false);
  assert.equal(isValidPlusCode('AAAAAAAAAAAAAAAA'), false);
  assert.equal(isValidPlusCode('6FP9R28X+6W'), true);
});

test('out-of-range coordinates produce no code rather than a bogus one', () => {
  assert.equal(encodePlusCode(999, 7.0498), null);
  assert.equal(encodePlusCode(4.8156, 999), null);
  assert.equal(encodePlusCode(NaN, 7.0498), null);
  assert.equal(encodePlusCode(undefined, 7.0498), null);
});

test('a shortened code recovers against a nearby reference point', () => {
  const full = encodePlusCode(LEKKI.lat, LEKKI.lng, 10);
  const short = shortenPlusCode(full, 6.5244, 3.3792); // Lagos island reference

  // Shortening is only valid when the reference is close. Lagos island is
  // ~35 km from Lekki, which is within the valid window for a 10-char code.
  assert.notEqual(short, full, 'expected the code to shorten');
  assert.equal(recoverPlusCode(short, 6.5244, 3.3792), full);
});

test('a shortened code does not recover against a far-away reference', () => {
  const full = encodePlusCode(LEKKI.lat, LEKKI.lng, 10);
  const short = shortenPlusCode(full, 6.5244, 3.3792);

  // Recovering against Port Harcourt must not silently produce the Lekki code.
  const recovered = recoverPlusCode(short, PORT_HARCOURT.lat, PORT_HARCOURT.lng);
  assert.notEqual(recovered, full);
});

test('distance between two codes matches the distance between the places', () => {
  const a = encodePlusCode(PORT_HARCOURT.lat, PORT_HARCOURT.lng, 10);
  const b = encodePlusCode(ISIOKPO.lat, ISIOKPO.lng, 10);

  const viaCodes = plusCodeDistanceMeters(a, b);
  const viaCoords = haversineMeters(PORT_HARCOURT, ISIOKPO);

  // Both should agree to within the cell size, since a 10-char cell is ~14 m.
  assert.ok(Math.abs(viaCodes - viaCoords) < 60, `${viaCodes} vs ${viaCoords}`);
});

test('haversine returns zero for the same point', () => {
  assert.equal(haversineMeters(PORT_HARCOURT, PORT_HARCOURT), 0);
});

test('haversine returns null for missing input', () => {
  assert.equal(haversineMeters(null, PORT_HARCOURT), null);
  assert.equal(haversineMeters(PORT_HARCOURT, undefined), null);
});

test('the verification link points at the exact coordinates', () => {
  const url = mapsSearchUrl(4.8156, 7.0498);
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.ok(url.endsWith('4.8156,7.0498'));
});

test('straight-line distance is plausible for a known pair', () => {
  const km = straightLineKm(PORT_HARCOURT, ISIOKPO);
  assert.ok(km > 10 && km < 40, `expected 10-40 km, got ${km.toFixed(1)}`);
});

// ---------------------------------------------------------------------------
// The routing plausibility guard
// ---------------------------------------------------------------------------

test('a route at walking pace is rejected', () => {
  // 32.9 km in 354 min is 5.5 km/h — the exact shape of the bad answer this
  // guard was written to catch.
  const verdict = isPlausible({ distanceMeters: 32900, durationSeconds: 354 * 60 }, 4300);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /speed/);
});

test('a route that detours absurdly far is rejected', () => {
  const verdict = isPlausible({ distanceMeters: 137600, durationSeconds: 128 * 60 }, 18000);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /detour/);
});

test('a believable route is accepted', () => {
  // PH centre to the airport: 8.5 km in 20 min is ~25 km/h.
  const verdict = isPlausible({ distanceMeters: 8500, durationSeconds: 20 * 60 }, 8000);
  assert.equal(verdict.ok, true);
});

test('a route with missing metrics is rejected', () => {
  assert.equal(isPlausible(null, 8000).ok, false);
  assert.equal(isPlausible({ distanceMeters: 0, durationSeconds: 0 }, 8000).ok, false);
  assert.equal(isPlausible({ distanceMeters: 8000, durationSeconds: 0 }, 8000).ok, false);
});
