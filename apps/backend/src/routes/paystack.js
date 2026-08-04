import express from 'express';
import crypto from 'crypto';
import { db } from '../lib/db/index.js';
import { orders } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Paystack webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // Find order by reference
      const [order] = await db.select().from(orders)
        .where(eq(orders.paymentReference, reference));

      if (order) {
        await db.update(orders).set({
          paymentStatus: 'paid',
        }).where(eq(orders.id, order.id));

        console.log(`✅ Payment confirmed for order ${order.ticketId}`);

        // Emit to order room
        req.app.get('io')?.to(`order:${order.id}`).emit('payment:confirmed', {
          orderId: order.id,
          ticketId: order.ticketId,
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

export default router;
