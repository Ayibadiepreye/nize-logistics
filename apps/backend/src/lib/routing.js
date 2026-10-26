import axios from 'axios';
import { haversineMeters } from './plusCode.js';

/**
 * OpenStreetMap-based routing, replacing the Google Distance Matrix / Directions
 * APIs (which require a paid API key).
 *
 * Endpoint: the public OSRM demo server.
 *   https://router.project-osrm.org
 *
 * IMPORTANT — a measured limitation, not a guess:
 *   The public OSRM demo server carries a Europe-centric OSM extract and its
 *   routing graph is incomplete for Nigeria. Probed on this machine:
 *     Ikeja -> MMIA          32.9 km / 354 min   (straight line is ~4 km)
 *     Isiokpo -> PH         137.6 km / 128 min   (should be ~45 km)
 *     PH centre -> Airport    8.5 km /  20 min   (plausible)
 *   So the demo server is reliable *inside* well-mapped city centres and badly
 *   wrong on longer or poorly-mapped roads. Rather than silently trust it, every
 *   result is sanity-checked below and rejected when it is implausible.
 *
 * When OSRM is rejected or unavailable we fall back to a straight-line estimate
 * scaled by a road-detour factor. That is a worse route but an honest distance,
 * and the rider is told which one they got.
 */

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 12000;

/**
 * A route that came from a real routing engine.
 */
const SOURCE_OSRM = 'osrm';
/**
 * A route we computed ourselves because OSRM was missing, slow, or implausible.
 */
const SOURCE_ESTIMATE = 'estimate';

/** Straight-line distance is never the driving distance; roads detour. */
const DETOUR_FACTOR = 1.35;
/** Average urban driving speed in Nigeria, km/h. Used only for the estimate. */
const URBAN_SPEED_KMH = 22;
/** Below this average speed a route is walking, not driving — reject it. */
const MIN_PLAUSIBLE_SPEED_KMH = 8;
/** Above this detour factor the route is obviously wrong — reject it. */
const MAX_PLAUSIBLE_DETOUR = 2.5;

// ---------------------------------------------------------------------------
// Route cache
//
// A driving route between two fixed points does not change within a day — roads
// don't move. Logistics traffic is dominated by repeat pairs (the same depot ->
// customer routes), so caching keyed by rounded coordinates makes those instant
// and cuts load on the public OSRM demo, which is rate-limited and unreliable
// for Nigeria. This is a free optimisation: no new dependency, no accuracy
// change, and it degrades to the same answer once the cache is cold.
//
// On Render's free tier the cache resets when the service spins down; that is
// acceptable — the first request after a wake pays the OSRM round-trip, then it
// is warm again for the rest of the day.
// ---------------------------------------------------------------------------

const ROUTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // roads don't change within a day
const ROUTE_CACHE_MAX = 5000; // bound memory; oldest entry is dropped past this
const routeCache = new Map();

/** ~1 m precision — enough to distinguish addresses, coarse enough to collide repeats. */
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function cacheKey(origin, destination) {
  return (
    `${round6(origin.lat)},${round6(origin.lng)}|` +
    `${round6(destination.lat)},${round6(destination.lng)}`
  );
}

function cacheGet(key) {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    routeCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (routeCache.size >= ROUTE_CACHE_MAX) routeCache.clear();
  routeCache.set(key, { value, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
}

/** Live cache stats for observability and tests. */
export function routeCacheStats() {
  return {
    size: routeCache.size,
    ttlMs: ROUTE_CACHE_TTL_MS,
    max: ROUTE_CACHE_MAX,
  };
}

/** Drop every cached route (used by tests and admin invalidation). */
export function clearRouteCache() {
  routeCache.clear();
}

/**
 * Ask OSRM for a driving route.
 * @param {{lat:number,lng:number}} origin
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<null|{distanceMeters:number,durationSeconds:number,geometry:object}>}
 */
async function queryOsrm(origin, destination) {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}`;

  try {
    const response = await axios.get(url, {
      params: {
        overview: 'full',
        geometries: 'geojson',
        alternatives: false,
        steps: false,
      },
      timeout: OSRM_TIMEOUT_MS,
    });

    const route = response.data?.routes?.[0];
    if (!route || typeof route.distance !== 'number') return null;

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry ?? null,
    };
  } catch (error) {
    const status = error?.response?.status;
    console.warn(
      `⚠️  OSRM request failed (${status || error.code || 'network'}) — using estimate`
    );
    return null;
  }
}

/**
 * Decide whether an OSRM route is believable.
 *
 * Two independent checks, either of which rejects the route:
 *   1. Average speed below walking pace means the engine routed through a field.
 *   2. Distance far beyond the straight-line distance means it left the map.
 *
 * Exported so the behaviour can be tested directly.
 */
export function isPlausible(osrm, straightLineMeters) {
  if (!osrm || osrm.distanceMeters <= 0 || osrm.durationSeconds <= 0) {
    return { ok: false, reason: 'missing metrics' };
  }

  const speedKmh = (osrm.distanceMeters / 1000) / (osrm.durationSeconds / 3600);
  if (speedKmh < MIN_PLAUSIBLE_SPEED_KMH) {
    return { ok: false, reason: `implausible speed ${speedKmh.toFixed(1)} km/h` };
  }

  const detour = osrm.distanceMeters / Math.max(straightLineMeters, 1);
  if (detour > MAX_PLAUSIBLE_DETOUR) {
    return { ok: false, reason: `implausible detour ${detour.toFixed(2)}x straight line` };
  }

  return { ok: true };
}

/**
 * Straight-line estimate scaled for road detour. Used when OSRM is unavailable
 * or when its answer fails the plausibility check.
 */
function estimateRoute(origin, destination) {
  const straightLineMeters = haversineMeters(origin, destination) ?? 0;
  const distanceMeters = straightLineMeters * DETOUR_FACTOR;
  const durationSeconds = (distanceMeters / 1000 / URBAN_SPEED_KMH) * 3600;

  return {
    distanceMeters,
    durationSeconds,
    geometry: {
      type: 'LineString',
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    },
  };
}

/**
 * Resolve a driving route between two points.
 *
 * @param {{lat:number,lng:number}} origin
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<{
 *   distanceKm: number,
 *   durationMinutes: number,
 *   distanceText: string,
 *   durationText: string,
 *   geometry: object|null,
 *   source: 'osrm'|'estimate',
 *   note: string|null
 * }>}
 */
export async function resolveRoute(origin, destination) {
  if (!origin || !destination) {
    throw new Error('resolveRoute requires both origin and destination');
  }

  const key = cacheKey(origin, destination);
  const cached = cacheGet(key);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const straightLineMeters = haversineMeters(origin, destination) ?? 0;
  const osrm = await queryOsrm(origin, destination);
  const verdict = isPlausible(osrm, straightLineMeters);

  let chosen;
  let source;
  let note = null;

  if (verdict.ok) {
    chosen = osrm;
    source = SOURCE_OSRM;
  } else {
    chosen = estimateRoute(origin, destination);
    source = SOURCE_ESTIMATE;
    note =
      osrm === null
        ? 'routing engine unavailable — straight-line estimate'
        : `routing engine returned an implausible route (${verdict.reason}) — straight-line estimate`;
  }

  const distanceKm = chosen.distanceMeters / 1000;
  const durationMinutes = Math.ceil(chosen.durationSeconds / 60);

  const result = {
    distanceKm,
    durationMinutes,
    distanceText: `${distanceKm.toFixed(1)} km`,
    durationText: `${durationMinutes} min`,
    geometry: chosen.geometry ?? null,
    source,
    note,
  };

  cacheSet(key, result);
  return { ...result, cacheHit: false };
}

/**
 * Distance and duration only, with no geometry.
 * Convenience wrapper used by the pricing endpoints.
 */
export async function getDistance(origin, destination) {
  const route = await resolveRoute(origin, destination);
  return {
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    distanceText: route.distanceText,
    durationText: route.durationText,
    source: route.source,
    note: route.note,
    cacheHit: route.cacheHit,
  };
}

/**
 * Full route including the GeoJSON geometry used to draw the map polyline.
 */
export async function getRoute(origin, destination) {
  const route = await resolveRoute(origin, destination);
  return {
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    distanceText: route.distanceText,
    durationText: route.durationText,
    geometry: route.geometry,
    source: route.source,
    note: route.note,
    cacheHit: route.cacheHit,
  };
}

/**
 * Great-circle distance in kilometres. Never needs the network.
 * Used when a caller only wants a magnitude, not a route.
 */
export function straightLineKm(origin, destination) {
  return (haversineMeters(origin, destination) ?? 0) / 1000;
}

// ---------------------------------------------------------------------------
// Compatibility surface
//
// These names match what the routes already call, so call sites keep working
// while the underlying provider changes from Google to OSM. The shapes are
// identical to what the old google-maps.js returned.
// ---------------------------------------------------------------------------

/**
 * Distance and duration between two points. Formerly the Google Distance Matrix.
 * @type {(origin: {lat:number,lng:number}, destination: {lat:number,lng:number}) =>
 *   Promise<{distanceKm:number,durationMinutes:number,distanceText:string,durationText:string,source:string,note:string|null}>}
 */
export const getDistanceMatrix = getDistance;

/**
 * Full route geometry between two points. Formerly the Google Directions API.
 *
 * Returns `geometry` as a GeoJSON LineString (from OSRM) rather than the
 * encoded polyline Google used, because Leaflet draws GeoJSON natively and it
 * needs no decoder.
 *
 * @type {(origin: {lat:number,lng:number}, destination: {lat:number,lng:number}) =>
 *   Promise<{distanceKm:number,durationMinutes:number,distanceText:string,durationText:string,geometry:object|null,source:string,note:string|null}>}
 */
export const getDirections = getRoute;

