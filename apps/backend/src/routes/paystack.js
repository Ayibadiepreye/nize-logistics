import express from 'express';
import crypto from 'crypto';
import { db } from '../lib/db/index.js';
import { orders } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

/**
 * Paystack webhook.
 *
 * Signature verification MUST run against the exact bytes Paystack sent. The
 * previous implementation hashed `JSON.stringify(req.body)` after the global
 * express.json() middleware had already parsed the payload, so the computed
 * HMAC was over a re-serialised object and never matched — every webhook was
 * rejected with 401 and no card payment was ever confirmed.
 *
 * server.js mounts this router with express.raw() BEFORE express.json(), so
 * req.body here is the untouched Buffer.
 */
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error('[paystack] webhook received but PAYSTACK_SECRET_KEY is not configured');
      return res.status(500).send('Not configured');
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = req.headers['x-paystack-signature'];

    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    // Constant-time compare; timingSafeEqual throws on a length mismatch.
    const provided = Buffer.from(String(signature ?? ''), 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const valid =
      provided.length === expectedBuf.length && crypto.timingSafeEqual(provided, expectedBuf);

    if (!valid) {
      console.warn('[paystack] rejected webhook with an invalid signature');
      return res.status(401).send('Invalid signature');
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).send('Malformed payload');
    }

    // Acknowledge immediately — Paystack retries on anything slow or non-2xx,
    // and the work below must not hold the response open.
    res.status(200).send('OK');

    if (event?.event !== 'charge.success') return;

    const reference = event.data?.reference;
    if (!reference) return;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentReference, reference))
      .limit(1);

    if (!order) {
      console.warn(`[paystack] no order matches reference ${reference}`);
      return;
    }

    if (order.paymentStatus === 'paid') return; // Duplicate delivery — ignore.

    // Guard against an underpayment being marked as settled.
    const paidKobo = Number(event.data?.amount ?? 0);
    const expectedKobo = Math.round(parseFloat(order.totalPrice) * 100);
    if (paidKobo < expectedKobo) {
      console.warn(
        `[paystack] underpayment on ${order.ticketId}: got ${paidKobo}, expected ${expectedKobo}`
      );
      return;
    }

    await db
      .update(orders)
      .set({ paymentStatus: 'paid', updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    console.log(`[paystack] payment confirmed for ${order.ticketId}`);

    req.app.get('io')?.to(`order:${order.id}`).emit('payment:confirmed', {
      orderId: order.id,
      ticketId: order.ticketId,
    });
  } catch (error) {
    console.error('[paystack] webhook handler error:', error);
    if (!res.headersSent) res.status(500).send('Error');
  }
});

export default router;
