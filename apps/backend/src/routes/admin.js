import express from 'express';
import { db } from '../lib/db/index.js';
import { orders, users, invites, reports, pricingConfig, platformSettings } from '../lib/db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate, requireRole } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { sendEmail } from '../lib/email.js';

const router = express.Router();

// Get admin dashboard stats
router.get('/dashboard', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const [stats] = await db.select({
      totalOrders: sql`COUNT(*)`,
      pendingOrders: sql`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      activeOrders: sql`SUM(CASE WHEN status IN ('assigned', 'accepted', 'picked_up') THEN 1 ELSE 0 END)`,
      deliveredOrders: sql`SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)`,
      totalRevenue: sql`SUM(CASE WHEN payment_status = 'paid' THEN total_price ELSE 0 END)`,
    }).from(orders);

    const [riderStats] = await db.select({
      totalRiders: sql`COUNT(*)`,
      onlineRiders: sql`SUM(CASE WHEN is_online = true THEN 1 ELSE 0 END)`,
      busyRiders: sql`SUM(CASE WHEN is_busy = true THEN 1 ELSE 0 END)`,
    }).from(users).where(eq(users.role, 'rider'));

    const [reportStats] = await db.select({
      totalReports: sql`COUNT(*)`,
      openReports: sql`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      resolvedReports: sql`SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)`,
    }).from(reports);

    res.json({
      orders: stats || {
        totalOrders: 0,
        pendingOrders: 0,
        activeOrders: 0,
        deliveredOrders: 0,
        totalRevenue: '0',
      },
      riders: riderStats || {
        totalRiders: 0,
        onlineRiders: 0,
        busyRiders: 0,
      },
      reports: {
        totalReports: Number(reportStats?.totalReports || 0),
        openReports: Number(reportStats?.openReports || 0),
        resolvedReports: Number(reportStats?.resolvedReports || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all orders
router.get('/orders', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = db.select().from(orders);
    
    if (status) {
      query = query.where(eq(orders.status, status));
    }

    const allOrders = await query.orderBy(desc(orders.createdAt)).limit(limit).offset(offset);

    res.json({ orders: allOrders });
  } catch (error) {
    next(error);
  }
});

// Get all riders
router.get('/riders', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const riders = await db.select().from(users)
      .where(eq(users.role, 'rider'))
      .orderBy(desc(users.totalDeliveries));

    res.json({ riders });
  } catch (error) {
    next(error);
  }
});

// Create invite
router.post('/invite', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email || !role || !['rider', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

    const [invite] = await db.insert(invites).values({
      email,
      role,
      token,
      expiresAt,
      invitedBy: req.user.id,
    }).returning();

    // Send invite email
    const signupLink = `${process.env.FRONTEND_URL}/signup/${token}`;
    await sendEmail({
      to: email,
      subject: 'Invitation to Nize Logistics',
      html: `<h2>You've been invited!</h2><p>Role: ${role}</p><p><a href="${signupLink}">Complete Signup</a></p><p>Link expires in 7 days.</p>`,
    });

    res.json({ invite, signupLink });
  } catch (error) {
    next(error);
  }
});

// Get pricing config
router.get('/pricing', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const [config] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1));
    res.json({ pricing: config || { baseFare: '500.00', perKmRate: '150.00', minimumFare: '1000.00' } });
  } catch (error) {
    next(error);
  }
});

// Update pricing config
router.put('/pricing', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { baseFare, perKmRate, minimumFare } = req.body;

    await db.update(pricingConfig).set({
      baseFare: baseFare || null,
      perKmRate: perKmRate || null,
      minimumFare: minimumFare || null,
    }).where(eq(pricingConfig.id, 1));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get reports
router.get('/reports', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const allReports = await db.select().from(reports)
      .orderBy(desc(reports.createdAt));

    res.json({ reports: allReports });
  } catch (error) {
    next(error);
  }
});

// Update rider status
router.put('/rider/:riderId/status', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.update(users).set({ status }).where(eq(users.id, riderId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Assign order to rider (manual)
router.post('/order/:orderId/assign', authenticate, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order || order.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot assign this order' });
    }

    const [rider] = await db.select().from(users).where(eq(users.id, riderId));
    if (!rider || rider.role !== 'rider' || rider.status !== 'active') {
      return res.status(400).json({ error: 'Invalid rider' });
    }

    await db.update(orders).set({
      status: 'assigned',
      assignedRiderId: riderId,
      assignedAt: new Date(),
    }).where(eq(orders.id, orderId));

    await db.update(users).set({ isBusy: true }).where(eq(users.id, riderId));

    // Notify rider
    req.app.get('io').to(`user:${riderId}`).emit('rider:new-job', { orderId });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
