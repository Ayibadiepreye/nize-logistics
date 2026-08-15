/**
 * Canonical order status model (frontend mirror).
 *
 * Mirrors apps/backend/src/lib/orderStatus.js — keep the two in sync. Every
 * status label, colour and timeline in the UI reads from here so the platform
 * never shows "In Transit" on one page and "Dispatched" on another.
 */

export const ORDER_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUSES: OrderStatus[] = Object.values(ORDER_STATUS);

/** Ordered progression used for timelines and progress bars. */
export const ORDER_FLOW: OrderStatus[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.DELIVERED,
];

export const TERMINAL_STATUSES: OrderStatus[] = [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED];

export const ACTIVE_RIDER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING]: 'Pending',
  [ORDER_STATUS.ASSIGNED]: 'Assigned',
  [ORDER_STATUS.ACCEPTED]: 'Accepted',
  [ORDER_STATUS.PICKED_UP]: 'Picked Up',
  [ORDER_STATUS.IN_TRANSIT]: 'In Transit',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

/** What the status means, shown as helper text on tracking and detail views. */
export const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING]: 'Order received. We are matching it with a rider.',
  [ORDER_STATUS.ASSIGNED]: 'A rider has been assigned and is reviewing the job.',
  [ORDER_STATUS.ACCEPTED]: 'The rider accepted and is heading to the pickup address.',
  [ORDER_STATUS.PICKED_UP]: 'The package has been collected from the sender.',
  [ORDER_STATUS.IN_TRANSIT]: 'On the way to the drop-off address.',
  [ORDER_STATUS.DELIVERED]: 'Delivered. Thank you for riding with Nize.',
  [ORDER_STATUS.CANCELLED]: 'This order was cancelled.',
};

/** Semantic tone driving badge colours — maps onto design-system tones. */
export type StatusTone = 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'danger';

export const STATUS_TONES: Record<OrderStatus, StatusTone> = {
  [ORDER_STATUS.PENDING]: 'neutral',
  [ORDER_STATUS.ASSIGNED]: 'info',
  [ORDER_STATUS.ACCEPTED]: 'info',
  [ORDER_STATUS.PICKED_UP]: 'brand',
  [ORDER_STATUS.IN_TRANSIT]: 'warning',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger',
};

export function statusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status as OrderStatus] ?? status.replace(/_/g, ' ');
}

export function statusTone(status?: string | null): StatusTone {
  if (!status) return 'neutral';
  return STATUS_TONES[status as OrderStatus] ?? 'neutral';
}

export function isTerminal(status?: string | null): boolean {
  return TERMINAL_STATUSES.includes(status as OrderStatus);
}

/** 0–1 progress through the delivery flow, for progress bars. */
export function statusProgress(status?: string | null): number {
  if (status === ORDER_STATUS.CANCELLED) return 0;
  const idx = ORDER_FLOW.indexOf(status as OrderStatus);
  if (idx < 0) return 0;
  return idx / (ORDER_FLOW.length - 1);
}

/** Timestamp field on the order record marking entry into each state. */
export const STATUS_TIMESTAMP_FIELD: Record<string, string> = {
  [ORDER_STATUS.ASSIGNED]: 'assignedAt',
  [ORDER_STATUS.ACCEPTED]: 'acceptedAt',
  [ORDER_STATUS.PICKED_UP]: 'pickedUpAt',
  [ORDER_STATUS.IN_TRANSIT]: 'inTransitAt',
  [ORDER_STATUS.DELIVERED]: 'deliveredAt',
  [ORDER_STATUS.CANCELLED]: 'cancelledAt',
};
