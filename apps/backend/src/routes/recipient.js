import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, reports } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// Get order by recipient token
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const [order] = await db.select().from(orders)
      .where(eq(orders.recipientToken, token));

    if (!order) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    if (order.recipientLinkExpiresAt && new Date() > order.recipientLinkExpiresAt) {
      return res.status(410).json({ error: 'Link expired' });
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
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        deliveredAt: order.deliveredAt,
        deliveryProofUrl: order.deliveryProofUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Submit report via recipient link
router.post('/:token/report', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { type, description } = req.body;

    const [order] = await db.select().from(orders)
      .where(eq(orders.recipientToken, token));

    if (!order) {
      return res.status(404).json({ error: 'Invalid link' });
    }

    if (!['damaged', 'missing', 'wrong_item', 'other'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const [report] = await db.insert(reports).values({
      orderId: order.id,
      reportType: type,
      description,
      status: 'pending',
    }).returning();

    res.json({ success: true, reportId: report.id });
  } catch (error) {
    next(error);
  }
});

export default router;
