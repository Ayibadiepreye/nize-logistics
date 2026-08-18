import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users, reports } from '../lib/db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate, requireRole } from '../middleware/auth.js';
import { emitToOrder, emitToUser } from '../socket/index.js';
import { sendEmail } from '../lib/email.js';

const router = express.Router();

// Get rider dashboard stats
router.get('/dashboard', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const riderId = req.user.id;

    // Get current job
    const [currentJob] = await db.select().from(orders)
      .where(and(
        eq(orders.assignedRiderId, riderId),
        sql`${orders.status} IN ('assigned', 'accepted', 'picked_up')`
      ));

    // Get today's deliveries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayDeliveries = await db.select().from(orders)
      .where(and(
        eq(orders.assignedRiderId, riderId),
        eq(orders.status, 'delivered'),
        sql`${orders.deliveredAt} >= ${today}`
      ));

    const todayEarnings = todayDeliveries.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);

    res.json({
      currentJob: currentJob || null,
      todayDeliveries: todayDeliveries.length || 0,
      todayEarnings: todayEarnings.toFixed(2),
      isOnline: req.user.isOnline ?? false,
      isBusy: req.user.isBusy ?? false,
      totalDeliveries: req.user.totalDeliveries || 0,
      totalAmount: req.user.totalAmount || '0.00',
    });
  } catch (error) {
    next(error);
  }
});

// Toggle online status
router.post('/toggle-online', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const newStatus = !req.user.isOnline;

    await db.update(users).set({
      isOnline: newStatus,
      lastSeen: new Date(),
    }).where(eq(users.id, req.user.id));

    res.json({ isOnline: newStatus });
  } catch (error) {
    next(error);
  }
});

// Accept job
router.post('/accept/:orderId', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order || order.status !== 'assigned' || order.assignedRiderId !== req.user.id) {
      return res.status(400).json({ error: 'Cannot accept this order' });
    }

    await db.update(orders).set({
      status: 'accepted',
      acceptedAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Notify order room
    req.app.get('io').to(`order:${orderId}`).emit('order:status-update', {
      orderId,
      status: 'accepted',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark picked up
router.post('/pickup/:orderId', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { estimatedDeliveryTime } = req.body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order || order.assignedRiderId !== req.user.id) {
      return res.status(400).json({ error: 'Invalid order' });
    }

    await db.update(orders).set({
      status: 'picked_up',
      pickedUpAt: new Date(),
      estimatedDeliveryTime: estimatedDeliveryTime || null,
    }).where(eq(orders.id, orderId));

    req.app.get('io').to(`order:${orderId}`).emit('order:status-update', {
      orderId,
      status: 'picked_up',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark delivered
router.post('/deliver/:orderId', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { deliveryProofUrl, notes } = req.body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));

    if (!order || order.assignedRiderId !== req.user.id) {
      return res.status(400).json({ error: 'Invalid order' });
    }

    await db.update(orders).set({
      status: 'delivered',
      deliveredAt: new Date(),
      deliveryProofUrl: deliveryProofUrl || null,
      deliveryNotes: notes || null,
    }).where(eq(orders.id, orderId));

    // Update rider stats
    await db.update(users).set({
      isBusy: false,
      totalDeliveries: sql`${users.totalDeliveries} + 1`,
      totalAmount: sql`${users.totalAmount} + ${order.totalPrice}`,
    }).where(eq(users.id, req.user.id));

    req.app.get('io').to(`order:${orderId}`).emit('order:status-update', {
      orderId,
      status: 'delivered',
      timestamp: new Date().toISOString(),
    });

    // Send delivery confirmation email
    if (order.recipientEmail) {
      sendEmail({
        to: order.recipientEmail,
        subject: `Delivery Complete - ${order.ticketId}`,
        html: `<h2>Your package has been delivered!</h2><p>Ticket: ${order.ticketId}</p>`,
      }).catch(console.error);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get rider history
router.get('/history', authenticate, requireRole(['rider']), async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const history = await db.select().from(orders)
      .where(eq(orders.assignedRiderId, req.user.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ orders: history });
  } catch (error) {
    next(error);
  }
});

export default router;
