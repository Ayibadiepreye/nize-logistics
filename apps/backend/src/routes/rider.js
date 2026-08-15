import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users } from '../lib/db/schema.js';
import { eq, and, desc, inArray, sql, gte } from 'drizzle-orm';
import { authenticate, requireRider, blockIfPasswordResetPending } from '../middleware/auth.js';
import { sendEmail } from '../lib/email.js';
import { riderOrder } from '../lib/serialize.js';
import { AUDIT, recordAudit } from '../lib/audit.js';
import {
  ORDER_STATUS,
  ACTIVE_RIDER_STATUSES,
  assertTransition,
  STATUS_LABELS,
} from '../lib/orderStatus.js';
import { validateBody, validateUuidParam, riderStatusUpdateSchema } from '../lib/validate.js';

const router = express.Router();

// Every route below is rider-only and blocked while a password reset is pending.
router.use(authenticate, requireRider, blockIfPasswordResetPending);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Loads the rider's live job.
 *
 * The old query only looked at 'assigned' and 'picked_up', so a job vanished
 * from the dashboard the moment the rider accepted it. All four active states
 * count.
 */
async function loadCurrentJob(riderId) {
  const [job] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.assignedRiderId, riderId), inArray(orders.status, ACTIVE_RIDER_STATUSES)))
    .orderBy(desc(orders.assignedAt))
    .limit(1);
  return job ?? null;
}

/** Fetches the order and verifies this rider owns it. */
async function loadOwnedOrder(orderId, riderId) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  if (order.assignedRiderId !== riderId) {
    const err = new Error('This delivery is not assigned to you');
    err.status = 403;
    throw err;
  }
  return order;
}

/** Applies a status change with transition + timestamp handling and broadcasting. */
async function advanceStatus({ req, order, nextStatus, extra = {} }) {
  assertTransition(order.status, nextStatus);

  const timestamps = {
    [ORDER_STATUS.ACCEPTED]: { acceptedAt: new Date() },
    [ORDER_STATUS.PICKED_UP]: { pickedUpAt: new Date() },
    [ORDER_STATUS.IN_TRANSIT]: { inTransitAt: new Date() },
    [ORDER_STATUS.DELIVERED]: { deliveredAt: new Date() },
  }[nextStatus];

  const [updated] = await db
    .update(orders)
    .set({ status: nextStatus, ...timestamps, ...extra, updatedAt: new Date() })
    .where(eq(orders.id, order.id))
    .returning();

  const payload = {
    orderId: order.id,
    ticketId: order.ticketId,
    status: nextStatus,
    label: STATUS_LABELS[nextStatus],
    timestamp: new Date().toISOString(),
  };
  req.app.get('io')?.to(`order:${order.id}`).emit('order:status-update', payload);
  req.app.get('io')?.emit('admin:order-update', payload);

  await recordAudit({
    actor: req.user,
    action: AUDIT.ORDER_STATUS,
    entityType: 'order',
    entityId: order.ticketId,
    summary: `${order.ticketId} → ${STATUS_LABELS[nextStatus]}`,
    req,
  });

  return updated;
}

/** Dashboard: live job, today's numbers, lifetime totals. */
router.get('/dashboard', async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const today = startOfToday();
    const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [currentJob, todayRows, weekRows] = await Promise.all([
      loadCurrentJob(riderId),
      db
        .select({ total: orders.totalPrice })
        .from(orders)
        .where(
          and(
            eq(orders.assignedRiderId, riderId),
            eq(orders.status, ORDER_STATUS.DELIVERED),
            gte(orders.deliveredAt, today)
          )
        ),
      db
        .select({ total: orders.totalPrice })
        .from(orders)
        .where(
          and(
            eq(orders.assignedRiderId, riderId),
            eq(orders.status, ORDER_STATUS.DELIVERED),
            gte(orders.deliveredAt, weekStart)
          )
        ),
    ]);

    const sum = (rows) => rows.reduce((acc, r) => acc + parseFloat(r.total || 0), 0);

    res.json({
      currentJob: riderOrder(currentJob),
      today: { deliveries: todayRows.length, earnings: sum(todayRows).toFixed(2) },
      week: { deliveries: weekRows.length, earnings: sum(weekRows).toFixed(2) },
      lifetime: {
        deliveries: req.user.totalDeliveries ?? 0,
        earnings: req.user.totalAmount ?? '0',
      },
      isOnline: req.user.isOnline,
      isBusy: req.user.isBusy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Go on/offline. Accepts an explicit value so a flaky connection can't leave
 * the rider toggled the wrong way by a retried request.
 */
router.post('/toggle-online', async (req, res, next) => {
  try {
    const desired = typeof req.body?.isOnline === 'boolean' ? req.body.isOnline : !req.user.isOnline;

    await db
      .update(users)
      .set({ isOnline: desired, lastSeen: new Date(), updatedAt: new Date() })
      .where(eq(users.id, req.user.id));

    res.json({ isOnline: desired });
  } catch (error) {
    next(error);
  }
});

/** Report the rider's live position (also pushed over the socket while moving). */
router.post('/location', async (req, res, next) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Valid coordinates are required' });
    }

    await db
      .update(users)
      .set({ currentLat: String(lat), currentLng: String(lng), lastSeen: new Date() })
      .where(eq(users.id, req.user.id));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/** Accept an assigned job. */
router.post('/accept/:orderId', validateUuidParam('orderId'), async (req, res, next) => {
  try {
    const order = await loadOwnedOrder(req.params.orderId, req.user.id);
    const updated = await advanceStatus({ req, order, nextStatus: ORDER_STATUS.ACCEPTED });
    await db.update(users).set({ isBusy: true }).where(eq(users.id, req.user.id));
    res.json({ success: true, order: riderOrder(updated) });
  } catch (error) {
    next(error);
  }
});

/**
 * Decline an assigned job — it returns to the pending pool for reassignment.
 * The decline count feeds the admin alert threshold.
 */
router.post('/decline/:orderId', validateUuidParam('orderId'), async (req, res, next) => {
  try {
    const order = await loadOwnedOrder(req.params.orderId, req.user.id);

    if (order.status !== ORDER_STATUS.ASSIGNED) {
      return res.status(409).json({ error: 'Only a newly assigned job can be declined' });
    }

    await db
      .update(orders)
      .set({
        status: ORDER_STATUS.PENDING,
        assignedRiderId: null,
        assignedAt: null,
        declinedCount: sql`COALESCE(${orders.declinedCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await db.update(users).set({ isBusy: false }).where(eq(users.id, req.user.id));

    req.app.get('io')?.emit('admin:order-update', {
      orderId: order.id,
      ticketId: order.ticketId,
      status: ORDER_STATUS.PENDING,
      declined: true,
    });

    await recordAudit({
      actor: req.user,
      action: AUDIT.ORDER_UNASSIGNED,
      entityType: 'order',
      entityId: order.ticketId,
      summary: `${req.user.username} declined ${order.ticketId}`,
      req,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/** Collected from the sender. */
router.post(
  '/pickup/:orderId',
  validateUuidParam('orderId'),
  validateBody(riderStatusUpdateSchema),
  async (req, res, next) => {
    try {
      const order = await loadOwnedOrder(req.params.orderId, req.user.id);
      const updated = await advanceStatus({
        req,
        order,
        nextStatus: ORDER_STATUS.PICKED_UP,
        extra: { estimatedDeliveryTime: req.body.estimatedDeliveryTime ?? null },
      });
      res.json({ success: true, order: riderOrder(updated) });
    } catch (error) {
      next(error);
    }
  }
);

/** On the road to the drop-off. */
router.post('/in-transit/:orderId', validateUuidParam('orderId'), async (req, res, next) => {
  try {
    const order = await loadOwnedOrder(req.params.orderId, req.user.id);
    const updated = await advanceStatus({ req, order, nextStatus: ORDER_STATUS.IN_TRANSIT });
    res.json({ success: true, order: riderOrder(updated) });
  } catch (error) {
    next(error);
  }
});

/** Delivered — records proof, frees the rider and updates lifetime stats. */
router.post(
  '/deliver/:orderId',
  validateUuidParam('orderId'),
  validateBody(riderStatusUpdateSchema),
  async (req, res, next) => {
    try {
      const order = await loadOwnedOrder(req.params.orderId, req.user.id);

      const updated = await advanceStatus({
        req,
        order,
        nextStatus: ORDER_STATUS.DELIVERED,
        extra: {
          deliveryProofUrl: req.body.deliveryProofUrl || null,
          deliveryNotes: req.body.notes || null,
          // Cash orders settle at the door.
          ...(order.paymentMethod === 'cod' && req.body.cashCollected
            ? { cashCollected: true, paymentStatus: 'paid' }
            : {}),
        },
      });

      await db
        .update(users)
        .set({
          isBusy: false,
          totalDeliveries: sql`COALESCE(${users.totalDeliveries}, 0) + 1`,
          totalAmount: sql`COALESCE(${users.totalAmount}, 0) + ${order.totalPrice}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user.id));

      if (order.recipientEmail) {
        sendEmail({
          to: order.recipientEmail,
          subject: `Delivered — ${order.ticketId}`,
          html: `<h2>Your package has arrived</h2><p>Ticket ${order.ticketId} was delivered successfully.</p>`,
        }).catch((err) => console.error('[email] delivery confirmation failed:', err.message));
      }

      res.json({ success: true, order: riderOrder(updated) });
    } catch (error) {
      next(error);
    }
  }
);

/** Paginated delivery history with an earnings summary. */
router.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [history, [{ count }], [totals]] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(eq(orders.assignedRiderId, req.user.id))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`COUNT(*)::int` })
        .from(orders)
        .where(eq(orders.assignedRiderId, req.user.id)),
      db
        .select({
          delivered: sql`COUNT(*) FILTER (WHERE status = 'delivered')::int`,
          cancelled: sql`COUNT(*) FILTER (WHERE status = 'cancelled')::int`,
          earnings: sql`COALESCE(SUM(total_price) FILTER (WHERE status = 'delivered'), 0)`,
        })
        .from(orders)
        .where(eq(orders.assignedRiderId, req.user.id)),
    ]);

    res.json({
      orders: history.map(riderOrder),
      pagination: { page, limit, total: Number(count) || 0 },
      summary: {
        delivered: Number(totals?.delivered) || 0,
        cancelled: Number(totals?.cancelled) || 0,
        earnings: totals?.earnings ?? '0',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
