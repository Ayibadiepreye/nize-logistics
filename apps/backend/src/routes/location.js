import express from 'express';
import { db } from '../lib/db/index.js';
import { users, orders } from '../lib/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate, requireRole } from '../middleware/auth.js';
import { reverseGeocode } from '../lib/google-maps.js';

const router = express.Router();

// Update rider location (REST fallback when socket unavailable)
router.post('/update', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const { lat, lng, orderId } = req.body;

    if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      return res.status(400).json({ error: 'Valid lat and lng required' });
    }

    // Update rider location in database
    await db.update(users).set({
      currentLat: parseFloat(lat).toFixed(7),
      currentLng: parseFloat(lng).toFixed(7),
      lastSeen: new Date(),
    }).where(eq(users.id, req.user.id));

    // Broadcast via socket if connected and has active order
    const io = req.app.get('io');
    if (io && orderId) {
      io.to(`order:${orderId}`).emit('rider:location-update', {
        riderId: req.user.id,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    next(error);
  }
});

// Get rider's current location (for admin or tracking)
router.get('/rider/:riderId', async (req, res, next) => {
  try {
    const { riderId } = req.params;

    const [rider] = await db.select({
      id: users.id,
      fullName: users.fullName,
      currentLat: users.currentLat,
      currentLng: users.currentLng,
      lastSeen: users.lastSeen,
      isOnline: users.isOnline,
      vehicleType: users.vehicleType,
      plateNumber: users.plateNumber,
    }).from(users).where(
      and(
        eq(users.id, riderId),
        eq(users.role, 'rider')
      )
    );

    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }

    let address = null;
    if (rider.currentLat && rider.currentLng) {
      const geocodeResult = await reverseGeocode(
        parseFloat(rider.currentLat),
        parseFloat(rider.currentLng)
      );
      address = geocodeResult?.formattedAddress || null;
    }

    res.json({
      rider: {
        id: rider.id,
        fullName: rider.fullName,
        vehicleType: rider.vehicleType,
        plateNumber: rider.plateNumber,
        isOnline: rider.isOnline,
        lastSeen: rider.lastSeen,
        location: rider.currentLat && rider.currentLng ? {
          lat: parseFloat(rider.currentLat),
          lng: parseFloat(rider.currentLng),
          address,
          updatedAt: rider.lastSeen,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get assigned rider's location for a specific order (public for tracking)
router.get('/order/:orderId/rider', async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select({
      id: orders.id,
      ticketId: orders.ticketId,
      status: orders.status,
      assignedRiderId: orders.assignedRiderId,
    }).from(orders).where(eq(orders.id, orderId));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.assignedRiderId) {
      return res.json({ rider: null, message: 'No rider assigned yet' });
    }

    const [rider] = await db.select({
      id: users.id,
      fullName: users.fullName,
      currentLat: users.currentLat,
      currentLng: users.currentLng,
      lastSeen: users.lastSeen,
      isOnline: users.isOnline,
      vehicleType: users.vehicleType,
      plateNumber: users.plateNumber,
      phone: users.phone,
    }).from(users).where(eq(users.id, order.assignedRiderId));

    if (!rider) {
      return res.json({ rider: null });
    }

    res.json({
      rider: {
        id: rider.id,
        fullName: rider.fullName,
        vehicleType: rider.vehicleType,
        plateNumber: rider.plateNumber,
        phone: rider.phone,
        isOnline: rider.isOnline,
        location: rider.currentLat && rider.currentLng ? {
          lat: parseFloat(rider.currentLat),
          lng: parseFloat(rider.currentLng),
          updatedAt: rider.lastSeen,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all online riders' locations (admin only)
router.get('/riders/online', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const onlineRiders = await db.select({
      id: users.id,
      fullName: users.fullName,
      currentLat: users.currentLat,
      currentLng: users.currentLng,
      lastSeen: users.lastSeen,
      isBusy: users.isBusy,
      vehicleType: users.vehicleType,
      plateNumber: users.plateNumber,
    }).from(users).where(
      and(
        eq(users.role, 'rider'),
        eq(users.isOnline, true)
      )
    );

    const riders = onlineRiders
      .filter(r => r.currentLat && r.currentLng)
      .map(r => ({
        id: r.id,
        fullName: r.fullName,
        vehicleType: r.vehicleType,
        plateNumber: r.plateNumber,
        isBusy: r.isBusy,
        location: {
          lat: parseFloat(r.currentLat),
          lng: parseFloat(r.currentLng),
          updatedAt: r.lastSeen,
        },
      }));

    res.json({ riders, count: riders.length });
  } catch (error) {
    next(error);
  }
});

export default router;
