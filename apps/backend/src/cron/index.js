import cron from 'node-cron';
import { db } from '../lib/db/index.js';
import { orders, users, platformSettings } from '../lib/db/schema.js';
import { eq, and, lt, sql } from 'drizzle-orm';
import { deleteFromCloudinary } from '../lib/cloudinary.js';

/** Straight-line km between two points. */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Closest rider to the pickup point. Riders with no known position sort last
 * but remain eligible, so a pickup is never left unassigned just because a
 * rider's phone has not reported in yet.
 */
function pickNearestRider(candidates, order) {
  const pickupLat = parseFloat(order.pickupLat);
  const pickupLng = parseFloat(order.pickupLng);

  return candidates
    .map((rider) => {
      const known =
        Number.isFinite(pickupLat) && Number.isFinite(pickupLng) && rider.currentLat && rider.currentLng;
      return {
        rider,
        distance: known
          ? distanceKm(pickupLat, pickupLng, parseFloat(rider.currentLat), parseFloat(rider.currentLng))
          : Infinity,
      };
    })
    .sort((a, b) => a.distance - b.distance)[0].rider;
}

export function startCronJobs(io) {
  console.log('⏰ Starting cron jobs...');

  // Daily pruning at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running daily pruning...');
    try {
      const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
      
      if (!settings || !settings.pruningEnabled) {
        console.log('Pruning disabled');
        return;
      }

      const imageThreshold = new Date(Date.now() - (settings.daysToKeepImages * 24 * 60 * 60 * 1000));
      const fullThreshold = new Date(Date.now() - (settings.daysToKeepFull * 24 * 60 * 60 * 1000));

      // Delete old order images
      const oldOrders = await db.select().from(orders).where(
        and(
          eq(orders.isPruned, false),
          lt(orders.createdAt, imageThreshold)
        )
      );

      for (const order of oldOrders) {
        if (order.packageImages && order.packageImages.length > 0) {
          for (const imageUrl of order.packageImages) {
            // Extract public_id from Cloudinary URL and delete
            const publicId = imageUrl.split('/').slice(-2).join('/').replace('.png', '').replace('.jpg', '');
            await deleteFromCloudinary(publicId);
          }
        }

        // Create text snapshot
        const snapshot = JSON.stringify({
          ticketId: order.ticketId,
          from: order.pickupAddress,
          to: order.dropoffAddress,
          status: order.status,
          price: order.totalPrice,
        });

        await db.update(orders).set({
          packageImages: [],
          deliveryProofUrl: null,
          imagesPrunedAt: new Date(),
          textSnapshot: snapshot,
        }).where(eq(orders.id, order.id));
      }

      console.log(`✅ Pruned ${oldOrders.length} orders`);
    } catch (error) {
      console.error('Pruning error:', error);
    }
  });

  // Check scheduled pickups every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const scheduledOrders = await db.select().from(orders).where(
        and(
          eq(orders.pickupType, 'scheduled'),
          eq(orders.status, 'pending'),
          lt(orders.scheduledPickupAt, now)
        )
      );

      for (const order of scheduledOrders) {
        // Pick the closest free rider rather than whichever row came back
        // first — a scheduled pickup in Diobu should not go to a rider sitting
        // in Oroazi when someone nearer is idle.
        const candidates = await db.select().from(users).where(
          and(
            eq(users.role, 'rider'),
            eq(users.isOnline, true),
            eq(users.isBusy, false),
            eq(users.status, 'active')
          )
        );

        if (!candidates.length) continue;

        const rider = pickNearestRider(candidates, order);

        await db.update(orders).set({
          status: 'assigned',
          assignedRiderId: rider.id,
          assignedAt: new Date(),
        }).where(eq(orders.id, order.id));

        await db.update(users).set({
          isBusy: true,
        }).where(eq(users.id, rider.id));

        // Notify rider via Socket.io
        io.to(`user:${rider.id}`).emit('rider:new-job', { orderId: order.id, ticketId: order.ticketId });
        io.emit('admin:order-update', { orderId: order.id, ticketId: order.ticketId, status: 'assigned' });

        console.log(`📦 Auto-assigned ${order.ticketId} to ${rider.username}`);
      }
    } catch (error) {
      console.error('Scheduled pickup check error:', error);
    }
  });

  // Auto-offline inactive riders every minute
  cron.schedule('* * * * *', async () => {
    try {
      const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
      const threshold = new Date(Date.now() - ((settings?.autoOfflineMinutes || 2) * 60 * 1000));

      await db.update(users).set({ isOnline: false }).where(
        and(
          eq(users.role, 'rider'),
          eq(users.isOnline, true),
          lt(users.lastSeen, threshold)
        )
      );
    } catch (error) {
      console.error('Auto-offline error:', error);
    }
  });

  // Expire recipient links every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      await db.update(orders).set({ recipientToken: null }).where(
        lt(orders.recipientLinkExpiresAt, now)
      );
    } catch (error) {
      console.error('Recipient link expiry error:', error);
    }
  });

  console.log('✅ All cron jobs scheduled');
}
