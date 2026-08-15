import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, reports } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { lookupLimiter } from '../middleware/rateLimit.js';
import { validateBody, reportSchema } from '../lib/validate.js';

const router = express.Router();

router.use(lookupLimiter);

/** Load an order from the recipient's tokenised link. */
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.recipientToken, token)).limit(1);

    if (!order) {
      return res.status(404).json({ error: 'This tracking link is not valid' });
    }

    if (order.recipientLinkExpiresAt && new Date() > order.recipientLinkExpiresAt) {
      return res.status(410).json({ error: 'This tracking link has expired' });
    }

    res.json({
      order: {
        ticketId: order.ticketId,
        status: order.status,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        senderName: order.senderName,
        recipientName: order.recipientName,
        distanceKm: order.distanceKm,
        totalPrice: order.totalPrice,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        pickedUpAt: order.pickedUpAt,
        inTransitAt: order.inTransitAt,
        deliveredAt: order.deliveredAt,
        deliveryProofUrl: order.deliveryProofUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Raise a problem report from the recipient link.
 *
 * This endpoint was completely broken: it inserted `reportType` and
 * `status: 'pending'`, but the table has `type` and defaults status to 'open',
 * so every submission threw. Recipients have no account, so `reporterRole`
 * stays null and the source is recorded in `reporterLabel`.
 */
router.post('/:token/report', validateBody(reportSchema), async (req, res, next) => {
  try {
    const { token } = req.params;
    const { type, description } = req.body;

    const [order] = await db.select().from(orders).where(eq(orders.recipientToken, token)).limit(1);

    if (!order) {
      return res.status(404).json({ error: 'This tracking link is not valid' });
    }

    if (order.recipientLinkExpiresAt && new Date() > order.recipientLinkExpiresAt) {
      return res.status(410).json({ error: 'This tracking link has expired' });
    }

    const [report] = await db
      .insert(reports)
      .values({
        orderId: order.id,
        reporterRole: null,
        reporterId: null,
        reporterLabel: 'recipient',
        type,
        description,
        status: 'open',
      })
      .returning();

    // Surface it on the admin dashboard immediately.
    req.app.get('io')?.emit('admin:new-report', {
      reportId: report.id,
      ticketId: order.ticketId,
      type,
    });

    res.status(201).json({
      success: true,
      reportId: report.id,
      message: 'Thank you — our team will look into this.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
