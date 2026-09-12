import express from 'express';
import crypto from 'crypto';
import { db } from '../lib/db/index.js';
import { orders } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Paystack webhook — must receive raw body for HMAC verification
// Note: This route is mounted BEFORE global JSON middleware in server.js
router.post('/webhook', async (req, res, next) => {
  try {
    // The raw body is available because we mount this route before express.json()
    // or we use a special raw body capture
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the body if it came as raw
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

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
