import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The route cache — pinned offline and deterministically.
 *
 * A driving route between two fixed points doesn't change within a day, and
 * logistics traffic is dominated by repeat pairs (the same depot -> customers).
 * Caching keyed by rounded coordinates makes repeats instant and spares the
 * public OSRM demo, which is rate-limited and unreliable for Nigeria.
 *
 * We point OSRM at an unreachable address so the engine fails fast and every
 * resolve falls back to the deterministic straight-line estimate. The cache
 * behaviour under test is identical regardless of which source produced the
 * cached answer, and the test never touches the network.
 */

const DEPOT = { lat: 4.8156, lng: 7.0498 }; // Port Harcourt
const CUSTOMER = { lat: 4.825, lng: 7.062 }; // a few km away

async function loadRouting() {
  process.env.OSRM_URL = 'http://127.0.0.1:1'; // nothing listens here → fast fallback
  return import('../src/lib/routing.js');
}

test('a repeat route resolves from cache with an identical answer', async () => {
  const { resolveRoute, clearRouteCache, routeCacheStats } = await loadRouting();
  clearRouteCache();
  assert.equal(routeCacheStats().size, 0);

  const first = await resolveRoute(DEPOT, CUSTOMER);
  assert.equal(first.cacheHit, false, 'first resolve is a cold miss');

  const again = await resolveRoute(DEPOT, CUSTOMER);
  assert.equal(again.cacheHit, true, 'second resolve must hit the cache');
  assert.equal(again.distanceKm, first.distanceKm, 'cached distance matches');
  assert.equal(again.durationMinutes, first.durationMinutes, 'cached duration matches');
  assert.equal(again.source, first.source, 'cached source matches');

  assert.ok(routeCacheStats().size >= 1, 'cache recorded the route');
});

test('clearRouteCache empties the cache', async () => {
  const { clearRouteCache, routeCacheStats } = await loadRouting();
  clearRouteCache();
  assert.equal(routeCacheStats().size, 0);
});

test('distinct coordinate pairs are cached separately', async () => {
  const { resolveRoute, clearRouteCache, routeCacheStats } = await loadRouting();
  clearRouteCache();
  const A = { lat: 4.81, lng: 7.04 };
  const B = { lat: 4.82, lng: 7.05 };
  const C = { lat: 4.83, lng: 7.06 };

  await resolveRoute(A, B);
  await resolveRoute(A, C);
  assert.equal(routeCacheStats().size, 2, 'two distinct pairs → two entries');

  const hit = await resolveRoute(A, B);
  assert.equal(hit.cacheHit, true, 'a known pair resolves from cache');
});

test('a point swapped to its destination is a different key', async () => {
  const { resolveRoute, clearRouteCache, routeCacheStats } = await loadRouting();
  clearRouteCache();
  const A = { lat: 4.81, lng: 7.04 };
  const B = { lat: 4.82, lng: 7.05 };

  await resolveRoute(A, B); // warm A->B
  const reverse = await resolveRoute(B, A); // B->A is a distinct pair
  assert.equal(reverse.cacheHit, false, 'direction matters; B->A is a miss');
  assert.equal(routeCacheStats().size, 2);
});
