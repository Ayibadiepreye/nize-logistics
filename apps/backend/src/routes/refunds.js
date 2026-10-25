import express from 'express';
import { db } from '../lib/db/index.js';
import { orders } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AUDIT, recordAudit } from '../lib/audit.js';
import axios from 'axios';

const router = express.Router();

// Refund data is commercially sensitive — admin only, including the status read
// which previously answered any authenticated caller (riders included).
const adminOnly = [authenticate, requireRole(['admin', 'super_admin'])];

// Process refund (admin only)
router.post('/:orderId/refund', adminOnly, async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Order payment not completed' });
    }

    if (order.paymentMethod !== 'paystack') {
      return res.status(400).json({ error: 'Only Paystack payments can be refunded automatically' });
    }

    if (!order.paymentReference) {
      return res.status(400).json({ error: 'No payment reference found' });
    }

    // Call Paystack Refund API
    try {
      const response = await axios.post(
        `https://api.paystack.co/refund`,
        {
          transaction: order.paymentReference,
          amount: Math.round(parseFloat(order.totalPrice) * 100), // Convert to kobo
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status) {
        // Update order status
        await db.update(orders).set({
          paymentStatus: 'refunded',
          updatedAt: new Date(),
        }).where(eq(orders.id, orderId));

        await recordAudit({
          actor: req.user,
          action: AUDIT.REFUND,
          entityType: 'order',
          entityId: order.ticketId,
          summary: `Refunded ₦${order.totalPrice} on ${order.ticketId}`,
          req,
        });

        res.json({
          success: true,
          message: 'Refund processed successfully',
          refundData: response.data.data,
        });
      } else {
        throw new Error(response.data.message || 'Refund failed');
      }
    } catch (paystackError) {
      console.error('Paystack refund error:', paystackError.response?.data || paystackError.message);
      return res.status(500).json({
        error: 'Failed to process refund',
        details: paystackError.response?.data?.message || paystackError.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get refund status
router.get('/:orderId/refund-status', adminOnly, async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      orderId: order.id,
      ticketId: order.ticketId,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalPrice: order.totalPrice,
      refundEligible: order.paymentStatus === 'paid' && order.status === 'cancelled',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
