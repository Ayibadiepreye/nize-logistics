import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { getDirections } from '../lib/google-maps.js';

const router = express.Router();

// Track order by ticket ID (public)
router.get('/:ticketId', async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const [order] = await db.select().from(orders)
      .where(eq(orders.ticketId, ticketId.toUpperCase()));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let riderData = null;
    if (order.assignedRiderId) {
      const [rider] = await db.select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        vehicleType: users.vehicleType,
        plateNumber: users.plateNumber,
        currentLat: users.currentLat,
        currentLng: users.currentLng,
        profilePhotoUrl: users.profilePhotoUrl,
      }).from(users).where(eq(users.id, order.assignedRiderId));

      riderData = rider;
    }

    // Get route directions for map polyline
    let routeData = null;
    if (order.pickupLat && order.pickupLng && order.dropoffLat && order.dropoffLng) {
      try {
        const directions = await getDirections(
          { lat: parseFloat(order.pickupLat), lng: parseFloat(order.pickupLng) },
          { lat: parseFloat(order.dropoffLat), lng: parseFloat(order.dropoffLng) }
        );
        if (directions) {
          routeData = {
            polyline: directions.polyline,
            distanceText: directions.distanceText,
            durationText: directions.durationText,
          };
        }
      } catch (err) {
        // Directions not critical for tracking, continue without
      }
    }

    res.json({
      order: {
        id: order.id,
        ticketId: order.ticketId,
        status: order.status,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        pickupLat: order.pickupLat,
        pickupLng: order.pickupLng,
        dropoffLat: order.dropoffLat,
        dropoffLng: order.dropoffLng,
        senderName: order.senderName,
        recipientName: order.recipientName,
        distanceKm: order.distanceKm,
        totalPrice: order.totalPrice,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        pickedUpAt: order.pickedUpAt,
        deliveredAt: order.deliveredAt,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        description: order.description,
      },
      rider: riderData,
      route: routeData,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
