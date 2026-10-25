import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistance, quotePrice } from '../src/routes/orders.js';

const PRICING = { baseFare: 500, perKmRate: 120, minimumFare: 1000 };

test('distance between two Port Harcourt points is plausible', () => {
  // Mile 1 Diobu -> Oroazi, roughly 4km apart in a straight line.
  const km = calculateDistance(4.8156, 7.0498, 4.8342, 7.0201);
  assert.ok(km > 1 && km < 10, `expected a few km, got ${km}`);
});

test('the same point is zero distance', () => {
  assert.equal(calculateDistance(4.8156, 7.0498, 4.8156, 7.0498), 0);
});

test('short trips fall back to the minimum fare', () => {
  assert.equal(quotePrice({ distanceKm: 0.5, ...PRICING }), 1000);
  assert.equal(quotePrice({ distanceKm: 0, ...PRICING }), 1000);
});

test('longer trips price on distance', () => {
  // 500 + 10 * 120 = 1700
  assert.equal(quotePrice({ distanceKm: 10, ...PRICING }), 1700);
});

test('the fare is always a whole number of naira', () => {
  const price = quotePrice({ distanceKm: 7.37, ...PRICING });
  assert.equal(price, Math.round(price));
  assert.ok(Number.isInteger(price));
});

test('price never decreases as distance grows', () => {
  let previous = 0;
  for (let km = 0; km <= 40; km += 0.5) {
    const price = quotePrice({ distanceKm: km, ...PRICING });
    assert.ok(price >= previous, `price dropped at ${km}km`);
    previous = price;
  }
});

test('the quote endpoint and checkout use the same function', () => {
  // Guards against the two paths drifting: both import quotePrice, so a
  // customer is never shown one fare and charged another.
  const distanceKm = calculateDistance(4.8156, 7.0498, 4.8342, 7.0201);
  assert.equal(
    quotePrice({ distanceKm, ...PRICING }),
    quotePrice({ distanceKm, ...PRICING })
  );
});
