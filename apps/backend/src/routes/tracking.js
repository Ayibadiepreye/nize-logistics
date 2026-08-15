import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users } from '../lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { lookupLimiter } from '../middleware/rateLimit.js';
import { trackingOrder } from '../lib/serialize.js';
import { ACTIVE_RIDER_STATUSES } from '../lib/orderStatus.js';

const router = express.Router();

/**
 * Public order tracking by ticket id.
 *
 * Ticket ids are only six characters, so this endpoint is rate limited and
 * deliberately narrow: it returns no phone numbers, no internal notes, and the
 * rider's live position only while a delivery is actually in progress.
 */
router.get('/:ticketId', lookupLimiter, async (req, res, next) => {
  try {
    const ticketId = String(req.params.ticketId || '').trim().toUpperCase();

    if (!/^NIZ-[A-Z0-9]{4,10}$/.test(ticketId)) {
      return res.status(400).json({ error: 'That does not look like a Nize ticket number' });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(sql`upper(${orders.ticketId})`, ticketId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'No order found with that ticket number' });
    }

    let riderData = null;
    if (order.assignedRiderId) {
      const [rider] = await db
        .select({
          fullName: users.fullName,
          phone: users.phone,
          vehicleType: users.vehicleType,
          plateNumber: users.plateNumber,
          profilePhotoUrl: users.profilePhotoUrl,
          currentLat: users.currentLat,
          currentLng: users.currentLng,
        })
        .from(users)
        .where(eq(users.id, order.assignedRiderId))
        .limit(1);

      if (rider) {
        const live = ACTIVE_RIDER_STATUSES.includes(order.status);
        riderData = {
          fullName: rider.fullName,
          vehicleType: rider.vehicleType,
          plateNumber: rider.plateNumber,
          profilePhotoUrl: rider.profilePhotoUrl,
          // Contact details and live position are only shared while the job runs.
          phone: live ? rider.phone : null,
          currentLat: live ? rider.currentLat : null,
          currentLng: live ? rider.currentLng : null,
        };
      }
    }

    res.json({ order: trackingOrder(order), rider: riderData, orderId: order.id });
  } catch (error) {
    next(error);
  }
});

export default router;
