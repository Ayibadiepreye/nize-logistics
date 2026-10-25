import axios from 'axios';

/**
 * Address lookup against OpenStreetMap's Nominatim service.
 *
 * Replaces the Google Geocoding API, which requires a paid API key.
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 *   - A valid User-Agent or Referer identifying the application is required.
 *     Requests without one are blocked outright.
 *   - Maximum 1 request per second.
 *   - No heavy use. This is a lookup for a human typing an address, never a
 *     batch job, so the volume here is fine.
 *
 * Results are cached in-process for an hour so repeat lookups (the same pickup
 * address quoted twice, a rider refreshing a dashboard) cost nothing.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'nize-logistics/1.0 (https://nize-logistics-frontend.vercel.app)';
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60 * 60 * 1000;

/** @type {Map<string, { at: number, value: any }>} */
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  // Keep the map from growing without bound on a long-lived process.
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Forward geocode: free-text address -> coordinates.
 *
 * Nigeria has very little structured address data, so a query for a small
 * business usually returns nothing. Callers must treat `null` as a normal,
 * expected outcome and fall back to a map pin rather than surfacing an error.
 *
 * @param {string} address
 * @returns {Promise<{lat:number,lng:number,formattedAddress:string,osmType:string}|null>}
 */
export async function geocodeAddress(address) {
  const query = String(address || '').trim();
  if (!query) return null;

  const cacheKey = `fwd:${query.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const response = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        q: query,
        format: 'jsonv2',
        addressdetails: 0,
        limit: 1,
        countrycodes: 'ng',
      },
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      timeout: TIMEOUT_MS,
    });

    const first = response.data?.[0];
    if (!first) {
      cacheSet(cacheKey, null);
      return null;
    }

    const result = {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      formattedAddress: first.display_name ?? query,
      osmType: first.type ?? null,
    };

    cacheSet(cacheKey, result);
    return result;
  } catch (error) {
    const status = error?.response?.status;
    console.warn(`⚠️  Nominatim search failed (${status || error.code || 'network'})`);
    return null;
  }
}

/**
 * Reverse geocode: coordinates -> nearest named place.
 *
 * Used to show the rider roughly where they are. OSM's coverage in Nigeria is
 * thin, so this frequently returns a road or a district rather than a building
 * name. That is fine for orientation; the Plus Code remains the authoritative
 * location reference.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{formattedAddress:string,osmType:string}|null>}
 */
export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const response = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: {
        lat,
        lon: lng,
        format: 'jsonv2',
        addressdetails: 0,
        zoom: 18,
      },
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      timeout: TIMEOUT_MS,
    });

    const result = response.data;
    if (!result || result.error) {
      cacheSet(cacheKey, null);
      return null;
    }

    const value = {
      formattedAddress: result.display_name ?? null,
      osmType: result.type ?? null,
    };

    cacheSet(cacheKey, value);
    return value;
  } catch (error) {
    const status = error?.response?.status;
    console.warn(`⚠️  Nominatim reverse failed (${status || error.code || 'network'})`);
    return null;
  }
}

/**
 * Search for places by name, for the optional address autocomplete.
 *
 * Returns several candidates so a human can pick, because OSM data in Nigeria
 * is sparse and a single best guess is often wrong.
 *
 * @param {string} query
 * @param {{limit?:number}} [opts]
 * @returns {Promise<Array<{lat:number,lng:number,formattedAddress:string,osmType:string}>>}
 */
export async function searchPlaces(query, { limit = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const cacheKey = `search:${q.toLowerCase()}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const response = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        q,
        format: 'jsonv2',
        addressdetails: 0,
        limit,
        countrycodes: 'ng',
      },
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      timeout: TIMEOUT_MS,
    });

    const results = (Array.isArray(response.data) ? response.data : []).map((r) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      formattedAddress: r.display_name,
      osmType: r.type ?? null,
    }));

    cacheSet(cacheKey, results);
    return results;
  } catch (error) {
    const status = error?.response?.status;
    console.warn(`⚠️  Nominatim place search failed (${status || error.code || 'network'})`);
    return [];
  }
}
