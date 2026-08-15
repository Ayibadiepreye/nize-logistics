import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users, pricingConfig } from '../lib/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { generateTicketId, generateRecipientToken } from '../utils/ticket.js';
import { initializeTransaction } from '../lib/paystack.js';
import { generateTicketImage } from '../lib/ticket.js';
import { sendEmail } from '../lib/email.js';
import { optionalAuth } from '../middleware/auth.js';
import { createOrderLimiter } from '../middleware/rateLimit.js';
import { ORDER_STATUS, canTransition } from '../lib/orderStatus.js';
import { AUDIT, recordAudit } from '../lib/audit.js';
import { trackingOrder } from '../lib/serialize.js';
import {
  validateBody,
  validateUuidParam,
  createOrderSchema,
  updateOrderSchema,
  cancelOrderSchema,
} from '../lib/validate.js';

const router = express.Router();

/** Great-circle distance in km. */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fare = max(minimumFare, baseFare + distance × perKmRate), rounded to whole naira.
 * Exported so the quote endpoint and the tests price identically to checkout.
 */
export function quotePrice({ distanceKm, baseFare, perKmRate, minimumFare }) {
  const raw = baseFare + distanceKm * perKmRate;
  return Math.round(Math.max(minimumFare, raw));
}

async function loadPricing() {
  const [pricing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1)).limit(1);
  return {
    baseFare: parseFloat(pricing?.baseFare ?? 500),
    perKmRate: parseFloat(pricing?.perKmRate ?? 120),
    minimumFare: parseFloat(pricing?.minimumFare ?? 1000),
  };
}

/**
 * Ownership check for anonymous orders.
 *
 * Orders are placed without an account, so the only thing tying a caller to an
 * order is knowing the sender's phone number. Admins bypass this. Without it,
 * anyone holding an order UUID could cancel or edit someone else's delivery.
 */
function canModifyOrder(req, order) {
  if (req.user && ['admin', 'super_admin'].includes(req.user.role)) return true;

  const supplied = String(req.body?.senderPhone ?? req.query?.senderPhone ?? req.headers['x-sender-phone'] ?? '');
  const digits = (v) => v.replace(/\D/g, '').slice(-10);
  return digits(supplied).length === 10 && digits(supplied) === digits(order.senderPhone || '');
}

/** Public price quote — lets the booking form show a fare before committing. */
router.post('/quote', async (req, res, next) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body ?? {};
    const coords = [pickupLat, pickupLng, dropoffLat, dropoffLng].map(Number);

    if (coords.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ error: 'Pickup and drop-off coordinates are required' });
    }

    const distanceKm = calculateDistance(coords[0], coords[1], coords[2], coords[3]);
    const pricing = await loadPricing();

    res.json({
      distanceKm: Number(distanceKm.toFixed(2)),
      totalPrice: quotePrice({ distanceKm, ...pricing }),
      pricing,
    });
  } catch (error) {
    next(error);
  }
});

/** Create an order. */
router.post('/', createOrderLimiter, optionalAuth, validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const body = req.body;

    const distanceKm = calculateDistance(body.pickupLat, body.pickupLng, body.dropoffLat, body.dropoffLng);
    const pricing = await loadPricing();
    const totalPrice = quotePrice({ distanceKm, ...pricing });

    const ticketId = generateTicketId();
    const recipientToken = generateRecipientToken();
    const recipientLinkExpiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const [order] = await db
      .insert(orders)
      .values({
        ticketId,
        pickupType: body.pickupType,
        scheduledPickupAt: body.scheduledPickupAt ?? null,
        pickupAddress: body.pickupAddress,
        pickupLat: String(body.pickupLat),
        pickupLng: String(body.pickupLng),
        dropoffAddress: body.dropoffAddress,
        dropoffLat: String(body.dropoffLat),
        dropoffLng: String(body.dropoffLng),
        senderName: body.senderName,
        senderPhone: body.senderPhone,
        senderWhatsapp: body.senderWhatsapp || null,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        recipientWhatsapp: body.recipientWhatsapp || null,
        recipientEmail: body.recipientEmail || null,
        packageImages: body.packageImages || [],
        description: body.description || null,
        notes: body.notes || null,
        distanceKm: distanceKm.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        paymentMethod: body.paymentMethod,
        paymentStatus: 'pending',
        status: ORDER_STATUS.PENDING,
        recipientToken,
        recipientLinkExpiresAt,
      })
      .returning();

    // Card payments need a Paystack transaction before the customer is redirected.
    let paymentData = null;
    if (body.paymentMethod === 'paystack') {
      try {
        paymentData = await initializeTransaction({
          email: body.recipientEmail || `${body.senderPhone.replace(/\D/g, '')}@nizelogistics.com`,
          amount: totalPrice,
          reference: `${ticketId}-${Date.now()}`,
          callback_url: `${process.env.FRONTEND_URL}/track/${ticketId}?payment=done`,
        });

        await db
          .update(orders)
          .set({ paymentReference: paymentData.reference })
          .where(eq(orders.id, order.id));
      } catch (error) {
        // The order is already saved; surface the payment failure without
        // losing the booking so an admin can still dispatch it as cash.
        console.error('[paystack] initialise failed:', error.message);
        return res.status(502).json({
          error: 'Order saved, but we could not start the card payment. Please pay on delivery or try again.',
          order: { id: order.id, ticketId: order.ticketId, totalPrice: order.totalPrice },
        });
      }
    }

    // Fire-and-forget notifications — never block the booking response.
    if (body.recipientEmail) {
      generateTicketImage(order)
        .catch(() => null)
        .then(() =>
          sendEmail({
            to: body.recipientEmail,
            subject: `Nize Logistics — Order ${ticketId}`,
            html: `<h2>A package is on its way</h2>
                   <p>${body.senderName} booked a delivery to you.</p>
                   <p>Track it any time: <a href="${process.env.FRONTEND_URL}/track/${ticketId}">${ticketId}</a></p>`,
          }).catch((err) => console.error('[email] order confirmation failed:', err.message))
        );
    }

    res.status(201).json({
      order: {
        id: order.id,
        ticketId: order.ticketId,
        totalPrice: order.totalPrice,
        distanceKm: order.distanceKm,
        status: order.status,
        paymentMethod: order.paymentMethod,
        trackingUrl: `${process.env.FRONTEND_URL}/track/${order.ticketId}`,
        recipientTrackingUrl: `${process.env.FRONTEND_URL}/track/${order.ticketId}?r=${recipientToken}`,
      },
      payment: paymentData,
    });
  } catch (error) {
    next(error);
  }
});

/** Riders currently online and free, nearest first. */
router.get('/available-riders', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);

    const availableRiders = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        vehicleType: users.vehicleType,
        plateNumber: users.plateNumber,
        totalDeliveries: users.totalDeliveries,
        currentLat: users.currentLat,
        currentLng: users.currentLng,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'rider'),
          eq(users.status, 'active'),
          eq(users.isOnline, true),
          eq(users.isBusy, false)
        )
      );

    const ridersWithDistance = availableRiders
      .map((rider) => {
        const known = hasOrigin && rider.currentLat && rider.currentLng;
        const distance = known
          ? calculateDistance(lat, lng, parseFloat(rider.currentLat), parseFloat(rider.currentLng))
          : null;
        // Location is deliberately dropped here — this endpoint is public.
        const { currentLat, currentLng, ...safe } = rider;
        return { ...safe, distanceToPickup: distance === null ? null : Number(distance.toFixed(2)) };
      })
      // Riders with an unknown position sort last rather than as distance 999.
      .sort((a, b) => (a.distanceToPickup ?? Infinity) - (b.distanceToPickup ?? Infinity));

    res.json({ riders: ridersWithDistance, count: ridersWithDistance.length });
  } catch (error) {
    next(error);
  }
});

/** Cancel an order. Requires the sender's phone number, or an admin session. */
router.post(
  '/:orderId/cancel',
  validateUuidParam('orderId'),
  optionalAuth,
  validateBody(cancelOrderSchema),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!canModifyOrder(req, order)) {
        return res.status(403).json({
          error: "Confirm the sender's phone number on this order to cancel it",
          code: 'OWNERSHIP_REQUIRED',
        });
      }

      if (!canTransition(order.status, ORDER_STATUS.CANCELLED)) {
        return res.status(409).json({
          error: `An order that is already ${order.status.replace(/_/g, ' ')} cannot be cancelled`,
        });
      }

      await db
        .update(orders)
        .set({
          status: ORDER_STATUS.CANCELLED,
          cancellationReason: req.body.reason || 'Cancelled by customer',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      if (order.assignedRiderId) {
        await db.update(users).set({ isBusy: false }).where(eq(users.id, order.assignedRiderId));
        req.app.get('io')?.to(`user:${order.assignedRiderId}`).emit('rider:job-cancelled', { orderId });
      }

      req.app.get('io')?.to(`order:${orderId}`).emit('order:status-update', {
        orderId,
        status: ORDER_STATUS.CANCELLED,
        timestamp: new Date().toISOString(),
      });

      await recordAudit({
        actor: req.user,
        action: AUDIT.ORDER_CANCELLED,
        entityType: 'order',
        entityId: order.ticketId,
        summary: `Order ${order.ticketId} cancelled`,
        metadata: { reason: req.body.reason ?? null },
        req,
      });

      // Paid card orders need a real Paystack refund, which only an admin can
      // trigger via /api/refunds — flag it rather than silently marking it done.
      const refundRequired = order.paymentStatus === 'paid' && order.paymentMethod === 'paystack';

      res.json({
        success: true,
        message: refundRequired
          ? 'Order cancelled. A refund will be processed by our team.'
          : 'Order cancelled',
        refundRequired,
      });
    } catch (error) {
      next(error);
    }
  }
);

/** Edit an order before a rider collects it. */
router.put('/:orderId', validateUuidParam('orderId'), optionalAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!canModifyOrder(req, order)) {
      return res.status(403).json({
        error: "Confirm the sender's phone number on this order to edit it",
        code: 'OWNERSHIP_REQUIRED',
      });
    }

    if (![ORDER_STATUS.PENDING, ORDER_STATUS.ASSIGNED, ORDER_STATUS.ACCEPTED].includes(order.status)) {
      return res.status(409).json({ error: 'This order can no longer be edited — the package is already in motion' });
    }

    const parsed = updateOrderSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid request',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }

    const [updated] = await db
      .update(orders)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    req.app.get('io')?.to(`order:${orderId}`).emit('order:updated', { orderId });

    res.json({ success: true, order: trackingOrder(updated) });
  } catch (error) {
    next(error);
  }
});

export default router;
