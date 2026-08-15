/**
 * Canonical order status model.
 *
 * This is the single source of truth for the delivery lifecycle. The frontend
 * mirrors it in src/lib/orderStatus.ts — keep the two in sync.
 *
 * Lifecycle:
 *   pending -> assigned -> accepted -> picked_up -> in_transit -> delivered
 * with `cancelled` reachable from any non-terminal state.
 */

export const ORDER_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const ORDER_STATUSES = Object.values(ORDER_STATUS);

/** Ordered progression used for timelines and progress indicators. */
export const ORDER_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.DELIVERED,
];

export const TERMINAL_STATUSES = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED];

/** Statuses where a rider is actively holding the job. */
export const ACTIVE_RIDER_STATUSES = [
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
];

/** Statuses that still count as "in the pipeline" for dashboards. */
export const OPEN_STATUSES = [ORDER_STATUS.PENDING, ...ACTIVE_RIDER_STATUSES];

/**
 * Allowed state transitions. Anything not listed here is rejected server-side,
 * which is what stops a rider from, say, delivering an order they never picked up.
 */
export const STATUS_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PICKED_UP, ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_TRANSIT]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

export function canTransition(from, to) {
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(
      `Cannot move order from "${STATUS_LABELS[from] || from}" to "${STATUS_LABELS[to] || to}"`
    );
    err.status = 409;
    throw err;
  }
}

/** Human labels — the only place status wording is defined. */
export const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Pending',
  [ORDER_STATUS.ASSIGNED]: 'Assigned',
  [ORDER_STATUS.ACCEPTED]: 'Accepted',
  [ORDER_STATUS.PICKED_UP]: 'Picked Up',
  [ORDER_STATUS.IN_TRANSIT]: 'In Transit',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

/** Timestamp column set when an order enters each state. */
export const STATUS_TIMESTAMP_FIELD = {
  [ORDER_STATUS.ASSIGNED]: 'assignedAt',
  [ORDER_STATUS.ACCEPTED]: 'acceptedAt',
  [ORDER_STATUS.PICKED_UP]: 'pickedUpAt',
  [ORDER_STATUS.IN_TRANSIT]: 'inTransitAt',
  [ORDER_STATUS.DELIVERED]: 'deliveredAt',
  [ORDER_STATUS.CANCELLED]: 'cancelledAt',
};

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}
