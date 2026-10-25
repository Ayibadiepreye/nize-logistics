import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUS,
  ORDER_FLOW,
  ACTIVE_RIDER_STATUSES,
  canTransition,
  assertTransition,
  isTerminal,
  STATUS_LABELS,
} from '../src/lib/orderStatus.js';

test('the happy path walks the whole flow', () => {
  for (let i = 0; i < ORDER_FLOW.length - 1; i++) {
    assert.ok(
      canTransition(ORDER_FLOW[i], ORDER_FLOW[i + 1]),
      `${ORDER_FLOW[i]} -> ${ORDER_FLOW[i + 1]} should be allowed`
    );
  }
});

test('a rider cannot skip the pickup step', () => {
  // The bug this guards: /rider/deliver had no status check, so an order could
  // jump straight from assigned to delivered.
  assert.equal(canTransition(ORDER_STATUS.ASSIGNED, ORDER_STATUS.DELIVERED), false);
  assert.equal(canTransition(ORDER_STATUS.ACCEPTED, ORDER_STATUS.DELIVERED), false);
  assert.equal(canTransition(ORDER_STATUS.PENDING, ORDER_STATUS.PICKED_UP), false);
});

test('delivered and cancelled are terminal', () => {
  assert.ok(isTerminal(ORDER_STATUS.DELIVERED));
  assert.ok(isTerminal(ORDER_STATUS.CANCELLED));

  for (const status of Object.values(ORDER_STATUS)) {
    if (isTerminal(status)) {
      assert.equal(canTransition(status, ORDER_STATUS.CANCELLED), false);
      assert.equal(canTransition(status, ORDER_STATUS.DELIVERED), false);
    }
  }
});

test('an order can be cancelled from any live state', () => {
  for (const status of [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.ASSIGNED,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.PICKED_UP,
    ORDER_STATUS.IN_TRANSIT,
  ]) {
    assert.ok(canTransition(status, ORDER_STATUS.CANCELLED), `${status} should be cancellable`);
  }
});

test('a declined job returns to the pending pool', () => {
  assert.ok(canTransition(ORDER_STATUS.ASSIGNED, ORDER_STATUS.PENDING));
  assert.ok(canTransition(ORDER_STATUS.ACCEPTED, ORDER_STATUS.PENDING));
  // Once collected it is too late to hand back — it must be cancelled instead.
  assert.equal(canTransition(ORDER_STATUS.PICKED_UP, ORDER_STATUS.PENDING), false);
});

test('assertTransition throws a 409 with a readable message', () => {
  assert.throws(
    () => assertTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.PICKED_UP),
    (err) => {
      assert.equal(err.status, 409);
      assert.match(err.message, /Delivered/);
      assert.match(err.message, /Picked Up/);
      return true;
    }
  );
});

test("a rider's active states cover everything between assignment and delivery", () => {
  // The old dashboard query only matched assigned + picked_up, so a job vanished
  // from the rider's screen the moment they accepted it.
  assert.deepEqual(ACTIVE_RIDER_STATUSES, ['assigned', 'accepted', 'picked_up', 'in_transit']);
  assert.ok(!ACTIVE_RIDER_STATUSES.includes(ORDER_STATUS.DELIVERED));
  assert.ok(!ACTIVE_RIDER_STATUSES.includes(ORDER_STATUS.PENDING));
});

test('every status has a human label', () => {
  for (const status of Object.values(ORDER_STATUS)) {
    assert.ok(STATUS_LABELS[status], `${status} needs a label`);
    assert.ok(!STATUS_LABELS[status].includes('_'));
  }
});
