import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users, pricingConfig } from '../lib/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { generateTicketId, generateRecipientToken } from '../utils/ticket.js';
import { initializeTransaction } from '../lib/paystack.js';
import { generateTicketImage } from '../lib/ticket.js';
import { sendEmail } from '../lib/email.js';
import { optionalAuth } from '../middleware/auth.js';
import { getDistanceMatrix, getDirections } from '../lib/google-maps.js';

const router = express.Router();

// Calculate distance using Haversine formula (fallback)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Create order
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      pickupType, scheduledPickupAt,
      pickupAddress, pickupLat, pickupLng,
      dropoffAddress, dropoffLat, dropoffLng,
      senderName, senderPhone, senderWhatsapp,
      recipientName, recipientPhone, recipientWhatsapp, recipientEmail,
      packageImages, description, notes,
      paymentMethod
    } = req.body;

    // Validate required fields
    if (!pickupType || !pickupAddress || !dropoffAddress || !senderName || !senderPhone || !recipientName || !recipientPhone || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate distance using Google Maps (with Haversine fallback)
    const origin = { lat: parseFloat(pickupLat), lng: parseFloat(pickupLng) };
    const destination = { lat: parseFloat(dropoffLat), lng: parseFloat(dropoffLng) };

    let distanceKm;
    let estimatedDuration = null;

    try {
      const distanceData = await getDistanceMatrix(origin, destination);
      distanceKm = distanceData.distanceKm;
      estimatedDuration = distanceData.durationMinutes;
    } catch (err) {
      // Fallback to Haversine
      distanceKm = calculateDistance(
        parseFloat(pickupLat), parseFloat(pickupLng),
        parseFloat(dropoffLat), parseFloat(dropoffLng)
      );
    }

    // Get pricing config
    const [pricing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1));
    const baseFare = parseFloat(pricing?.baseFare || 500);
    const perKmRate = parseFloat(pricing?.perKmRate || 120);
    const minimumFare = parseFloat(pricing?.minimumFare || 1000);

    const totalPrice = Math.max(minimumFare, baseFare + (distanceKm * perKmRate));

    const ticketId = generateTicketId();
    const recipientToken = generateRecipientToken();
    const recipientLinkExpiresAt = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)); // 2 days

    // Calculate estimated delivery time
    const estimatedDeliveryTime = estimatedDuration
      ? new Date(Date.now() + (estimatedDuration + 15) * 60 * 1000) // Add 15 min buffer for pickup
      : null;

    const [order] = await db.insert(orders).values({
      ticketId,
      pickupType,
      scheduledPickupAt: scheduledPickupAt ? new Date(scheduledPickupAt) : null,
      pickupAddress, pickupLat, pickupLng,
      dropoffAddress, dropoffLat, dropoffLng,
      senderName, senderPhone, senderWhatsapp,
      recipientName, recipientPhone, recipientWhatsapp, recipientEmail,
      packageImages: packageImages || [],
      description, notes,
      distanceKm: distanceKm.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      status: 'pending',
      recipientToken,
      recipientLinkExpiresAt,
      estimatedDeliveryTime,
    }).returning();

    // Initialize Paystack if not COD
    let paymentData = null;
    if (paymentMethod === 'paystack') {
      const email = recipientEmail || senderPhone + '@nizelogistics.com';
      paymentData = await initializeTransaction({
        email,
        amount: totalPrice,
        reference: `${ticketId}-${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/order/success?orderId=${order.id}`,
      });

      await db.update(orders).set({ 
        paymentReference: paymentData.reference 
      }).where(eq(orders.id, order.id));
    }

    // Generate ticket image (async, don't wait)
    generateTicketImage(order).then(ticketUrl => {
      sendEmail({
        to: recipientEmail || senderPhone + '@example.com',
        subject: `Nize Logistics - Order ${ticketId}`,
        html: `<h1>Order Created!</h1><p>Track: <a href="${process.env.FRONTEND_URL}/track/${ticketId}">${ticketId}</a></p>`,
      }).catch(console.error);
    }).catch(console.error);

    res.json({
      order: {
        id: order.id,
        ticketId: order.ticketId,
        totalPrice: order.totalPrice,
        distanceKm: order.distanceKm,
        estimatedDuration: estimatedDuration ? `${estimatedDuration} mins` : null,
        status: order.status,
        paymentMethod: order.paymentMethod,
        recipientTrackingLink: `${process.env.FRONTEND_URL}/recipient/${recipientToken}`,
      },
      payment: paymentData,
    });
  } catch (error) {
    next(error);
  }
});

// Get order by ID
router.get('/:orderId', optionalAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

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
      riderData = rider || null;
    }

    // Get directions polyline for map
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
        // Directions not critical, continue without
      }
    }

    res.json({
      order,
      rider: riderData,
      route: routeData,
    });
  } catch (error) {
    next(error);
  }
});

// Get available riders for immediate pickup
router.get('/available-riders', async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    const availableRiders = await db.select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      vehicleType: users.vehicleType,
      plateNumber: users.plateNumber,
      totalDeliveries: users.totalDeliveries,
      currentLat: users.currentLat,
      currentLng: users.currentLng,
    }).from(users).where(
      and(
        eq(users.role, 'rider'),
        eq(users.status, 'active'),
        eq(users.isOnline, true),
        eq(users.isBusy, false)
      )
    );

    // Calculate distance to each rider
    const ridersWithDistance = availableRiders.map(rider => {
      const distance = rider.currentLat && rider.currentLng ? 
        calculateDistance(
          parseFloat(lat), parseFloat(lng),
          parseFloat(rider.currentLat), parseFloat(rider.currentLng)
        ) : 999;
      
      return { ...rider, distanceToPickup: distance.toFixed(2) };
    }).sort((a, b) => a.distanceToPickup - b.distanceToPickup);

    res.json({ riders: ridersWithDistance });
  } catch (error) {
    next(error);
  }
});

// Cancel order
router.post('/:orderId/cancel', optionalAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Can only cancel if pending or assigned
    if (!['pending', 'assigned'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot cancel order in current status' });
    }

    // Update order status
    await db.update(orders).set({
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled by customer',
    }).where(eq(orders.id, orderId));

    // Free up rider if assigned
    if (order.assignedRiderId) {
      await db.update(users).set({ isBusy: false }).where(eq(users.id, order.assignedRiderId));
    }

    // Process refund if payment was made
    if (order.paymentStatus === 'paid' && order.paymentMethod === 'paystack') {
      // In production, call Paystack refund API here
      await db.update(orders).set({ paymentStatus: 'refunded' }).where(eq(orders.id, orderId));
    }

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// Update order (before pickup only)
router.put('/:orderId', optionalAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Can only update if pending or assigned
    if (!['pending', 'assigned'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot update order in current status' });
    }

    // Only allow updating certain fields
    const allowedUpdates = {};
    if (updates.pickupAddress) allowedUpdates.pickupAddress = updates.pickupAddress;
    if (updates.dropoffAddress) allowedUpdates.dropoffAddress = updates.dropoffAddress;
    if (updates.senderPhone) allowedUpdates.senderPhone = updates.senderPhone;
    if (updates.recipientPhone) allowedUpdates.recipientPhone = updates.recipientPhone;
    if (updates.notes) allowedUpdates.notes = updates.notes;
    if (updates.scheduledPickupAt) allowedUpdates.scheduledPickupAt = new Date(updates.scheduledPickupAt);

    // Recalculate distance if addresses changed
    if (updates.pickupLat && updates.pickupLng && updates.dropoffLat && updates.dropoffLng) {
      allowedUpdates.pickupLat = updates.pickupLat;
      allowedUpdates.pickupLng = updates.pickupLng;
      allowedUpdates.dropoffLat = updates.dropoffLat;
      allowedUpdates.dropoffLng = updates.dropoffLng;

      try {
        const distanceData = await getDistanceMatrix(
          { lat: parseFloat(updates.pickupLat), lng: parseFloat(updates.pickupLng) },
          { lat: parseFloat(updates.dropoffLat), lng: parseFloat(updates.dropoffLng) }
        );
        allowedUpdates.distanceKm = distanceData.distanceKm.toFixed(2);

        // Recalculate price
        const [pricing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1));
        const baseFare = parseFloat(pricing?.baseFare || 500);
        const perKmRate = parseFloat(pricing?.perKmRate || 120);
        const minimumFare = parseFloat(pricing?.minimumFare || 1000);
        allowedUpdates.totalPrice = Math.max(minimumFare, baseFare + (distanceData.distanceKm * perKmRate)).toFixed(2);
      } catch (err) {
        // Continue without distance recalculation
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    await db.update(orders).set(allowedUpdates).where(eq(orders.id, orderId));

    res.json({ success: true, message: 'Order updated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
