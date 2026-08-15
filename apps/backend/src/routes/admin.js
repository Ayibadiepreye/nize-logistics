import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db/index.js';
import { orders, users, invites, reports, pricingConfig } from '../lib/db/schema.js';
import { eq, and, or, desc, asc, sql, gte, lte, ilike, inArray, ne } from 'drizzle-orm';
import { authenticate, requireAdmin, blockIfPasswordResetPending } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { sendEmail } from '../lib/email.js';
import { adminOrder, adminUser } from '../lib/serialize.js';
import { AUDIT, listAudit, recordAudit } from '../lib/audit.js';
import { ORDER_STATUS, OPEN_STATUSES, STATUS_LABELS, canTransition } from '../lib/orderStatus.js';
import {
  validateBody,
  validateQuery,
  validateUuidParam,
  inviteSchema,
  pricingSchema,
  assignOrderSchema,
  orderQuerySchema,
  resetPasswordSchema,
  accountStatusSchema,
} from '../lib/validate.js';

const router = express.Router();
const BCRYPT_ROUNDS = 12;

router.use(authenticate, requireAdmin, blockIfPasswordResetPending);

/* ------------------------------------------------------------- dashboard */

/**
 * Headline numbers for the overview screen.
 *
 * Everything is aggregated in SQL rather than by pulling rows into Node —
 * the previous dashboard shipped every order to the client to count them.
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [[orderStats], [riderStats], [todayStats], [reportStats]] = await Promise.all([
      db
        .select({
          totalOrders: sql`COUNT(*)::int`,
          pendingOrders: sql`COUNT(*) FILTER (WHERE status = 'pending')::int`,
          activeOrders: sql`COUNT(*) FILTER (WHERE status IN ('assigned','accepted','picked_up','in_transit'))::int`,
          deliveredOrders: sql`COUNT(*) FILTER (WHERE status = 'delivered')::int`,
          cancelledOrders: sql`COUNT(*) FILTER (WHERE status = 'cancelled')::int`,
          totalRevenue: sql`COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid'), 0)`,
          outstanding: sql`COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'pending' AND status <> 'cancelled'), 0)`,
          avgDeliveryMinutes: sql`COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60) FILTER (WHERE status = 'delivered' AND delivered_at IS NOT NULL))::int, 0)`,
        })
        .from(orders),
      db
        .select({
          totalRiders: sql`COUNT(*)::int`,
          onlineRiders: sql`COUNT(*) FILTER (WHERE is_online = true)::int`,
          busyRiders: sql`COUNT(*) FILTER (WHERE is_busy = true)::int`,
          suspendedRiders: sql`COUNT(*) FILTER (WHERE status = 'suspended')::int`,
        })
        .from(users)
        .where(eq(users.role, 'rider')),
      db
        .select({
          ordersToday: sql`COUNT(*)::int`,
          revenueToday: sql`COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid'), 0)`,
        })
        .from(orders)
        .where(gte(orders.createdAt, today)),
      db
        .select({ openReports: sql`COUNT(*) FILTER (WHERE status = 'open')::int` })
        .from(reports),
    ]);

    // Daily order/revenue series for the trend chart.
    const trend = await db
      .select({
        day: sql`DATE(created_at)`,
        orders: sql`COUNT(*)::int`,
        delivered: sql`COUNT(*) FILTER (WHERE status = 'delivered')::int`,
        revenue: sql`COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid'), 0)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, weekAgo))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    const delivered = orderStats.deliveredOrders || 0;
    const finished = delivered + (orderStats.cancelledOrders || 0);

    res.json({
      orders: {
        ...orderStats,
        completionRate: finished ? Math.round((delivered / finished) * 100) : 0,
      },
      riders: riderStats,
      today: todayStats,
      reports: reportStats,
      trend: trend.map((t) => ({
        day: t.day,
        orders: Number(t.orders) || 0,
        delivered: Number(t.delivered) || 0,
        revenue: Number(t.revenue) || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** Rider leaderboard / performance table. */
router.get('/analytics/riders', async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        isOnline: users.isOnline,
        status: users.status,
        delivered: sql`COUNT(${orders.id}) FILTER (WHERE ${orders.status} = 'delivered')::int`,
        cancelled: sql`COUNT(${orders.id}) FILTER (WHERE ${orders.status} = 'cancelled')::int`,
        active: sql`COUNT(${orders.id}) FILTER (WHERE ${orders.status} IN ('assigned','accepted','picked_up','in_transit'))::int`,
        revenue: sql`COALESCE(SUM(${orders.totalPrice}) FILTER (WHERE ${orders.status} = 'delivered'), 0)`,
        avgMinutes: sql`COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (${orders.deliveredAt} - ${orders.assignedAt})) / 60) FILTER (WHERE ${orders.status} = 'delivered' AND ${orders.deliveredAt} IS NOT NULL))::int, 0)`,
      })
      .from(users)
      .leftJoin(orders, eq(orders.assignedRiderId, users.id))
      .where(eq(users.role, 'rider'))
      .groupBy(users.id)
      .orderBy(desc(sql`COUNT(${orders.id}) FILTER (WHERE ${orders.status} = 'delivered')`));

    res.json({ riders: rows });
  } catch (error) {
    next(error);
  }
});

/* ---------------------------------------------------------------- orders */

/**
 * Order list with real server-side search, filtering, sorting and pagination.
 * The admin table drives all of it — none of these controls are decorative.
 */
router.get('/orders', validateQuery(orderQuerySchema), async (req, res, next) => {
  try {
    const { status, paymentStatus, riderId, search, from, to, sort, order, page, limit } =
      req.validatedQuery;

    const filters = [];
    if (status) filters.push(eq(orders.status, status));
    if (paymentStatus) filters.push(eq(orders.paymentStatus, paymentStatus));
    if (riderId) filters.push(eq(orders.assignedRiderId, riderId));
    if (from) filters.push(gte(orders.createdAt, from));
    if (to) filters.push(lte(orders.createdAt, to));
    if (search) {
      const term = `%${search}%`;
      filters.push(
        or(
          ilike(orders.ticketId, term),
          ilike(orders.senderName, term),
          ilike(orders.recipientName, term),
          ilike(orders.senderPhone, term),
          ilike(orders.recipientPhone, term),
          ilike(orders.pickupAddress, term),
          ilike(orders.dropoffAddress, term)
        )
      );
    }

    const where = filters.length ? and(...filters) : undefined;
    const sortColumn = {
      createdAt: orders.createdAt,
      totalPrice: orders.totalPrice,
      status: orders.status,
      deliveredAt: orders.deliveredAt,
    }[sort];

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(where)
        .orderBy(order === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql`COUNT(*)::int` }).from(orders).where(where),
    ]);

    // Attach rider names without an N+1 lookup per row.
    const riderIds = [...new Set(rows.map((r) => r.assignedRiderId).filter(Boolean))];
    const riderMap = new Map();
    if (riderIds.length) {
      const riderRows = await db
        .select({ id: users.id, fullName: users.fullName, username: users.username, phone: users.phone })
        .from(users)
        .where(inArray(users.id, riderIds));
      riderRows.forEach((r) => riderMap.set(r.id, r));
    }

    res.json({
      orders: rows.map((o) => ({ ...adminOrder(o), rider: riderMap.get(o.assignedRiderId) ?? null })),
      pagination: { page, limit, total: Number(count) || 0 },
    });
  } catch (error) {
    next(error);
  }
});

/** Single order with its rider and any reports raised against it. */
router.get('/orders/:orderId', validateUuidParam('orderId'), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [rider, orderReports] = await Promise.all([
      order.assignedRiderId
        ? db.select().from(users).where(eq(users.id, order.assignedRiderId)).limit(1).then((r) => r[0])
        : null,
      db.select().from(reports).where(eq(reports.orderId, order.id)).orderBy(desc(reports.createdAt)),
    ]);

    res.json({
      order: adminOrder(order),
      rider: adminUser(rider),
      reports: orderReports,
    });
  } catch (error) {
    next(error);
  }
});

/** Assign (or reassign) an order to a rider. */
router.post(
  '/order/:orderId/assign',
  validateUuidParam('orderId'),
  validateBody(assignOrderSchema),
  async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { riderId } = req.body;

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (![ORDER_STATUS.PENDING, ORDER_STATUS.ASSIGNED].includes(order.status)) {
        return res.status(409).json({
          error: `An order that is ${STATUS_LABELS[order.status]} cannot be reassigned`,
        });
      }

      const [rider] = await db.select().from(users).where(eq(users.id, riderId)).limit(1);
      if (!rider || rider.role !== 'rider') {
        return res.status(400).json({ error: 'That user is not a rider' });
      }
      if (rider.status !== 'active') {
        return res.status(400).json({ error: 'That rider account is not active' });
      }

      const previousRiderId = order.assignedRiderId;

      await db
        .update(orders)
        .set({
          status: ORDER_STATUS.ASSIGNED,
          assignedRiderId: riderId,
          assignedAt: new Date(),
          acceptedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      await db.update(users).set({ isBusy: true }).where(eq(users.id, riderId));

      // Free the previous rider if this was a reassignment.
      if (previousRiderId && previousRiderId !== riderId) {
        await db.update(users).set({ isBusy: false }).where(eq(users.id, previousRiderId));
        req.app.get('io')?.to(`user:${previousRiderId}`).emit('rider:job-reassigned', { orderId });
      }

      req.app.get('io')?.to(`user:${riderId}`).emit('rider:new-job', { orderId, ticketId: order.ticketId });
      req.app.get('io')?.to(`order:${orderId}`).emit('order:status-update', {
        orderId,
        status: ORDER_STATUS.ASSIGNED,
        timestamp: new Date().toISOString(),
      });

      await recordAudit({
        actor: req.user,
        action: AUDIT.ORDER_ASSIGNED,
        entityType: 'order',
        entityId: order.ticketId,
        summary: `${order.ticketId} assigned to ${rider.fullName || rider.username}`,
        metadata: { riderId, previousRiderId },
        req,
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/** Pull an order back into the unassigned pool. */
router.post('/order/:orderId/unassign', validateUuidParam('orderId'), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.assignedRiderId) {
      return res.status(409).json({ error: 'This order has no rider assigned' });
    }
    if (![ORDER_STATUS.ASSIGNED, ORDER_STATUS.ACCEPTED].includes(order.status)) {
      return res.status(409).json({ error: 'The package is already in motion — cancel it instead' });
    }

    await db
      .update(orders)
      .set({
        status: ORDER_STATUS.PENDING,
        assignedRiderId: null,
        assignedAt: null,
        acceptedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await db.update(users).set({ isBusy: false }).where(eq(users.id, order.assignedRiderId));
    req.app.get('io')?.to(`user:${order.assignedRiderId}`).emit('rider:job-cancelled', { orderId: order.id });

    await recordAudit({
      actor: req.user,
      action: AUDIT.ORDER_UNASSIGNED,
      entityType: 'order',
      entityId: order.ticketId,
      summary: `${order.ticketId} returned to the queue`,
      req,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/** Admin-side cancellation. */
router.post('/order/:orderId/cancel', validateUuidParam('orderId'), async (req, res, next) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!canTransition(order.status, ORDER_STATUS.CANCELLED)) {
      return res.status(409).json({ error: `An order that is ${STATUS_LABELS[order.status]} cannot be cancelled` });
    }

    const reason = String(req.body?.reason ?? '').trim().slice(0, 500) || 'Cancelled by admin';

    await db
      .update(orders)
      .set({
        status: ORDER_STATUS.CANCELLED,
        cancellationReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (order.assignedRiderId) {
      await db.update(users).set({ isBusy: false }).where(eq(users.id, order.assignedRiderId));
      req.app.get('io')?.to(`user:${order.assignedRiderId}`).emit('rider:job-cancelled', { orderId: order.id });
    }

    req.app.get('io')?.to(`order:${order.id}`).emit('order:status-update', {
      orderId: order.id,
      status: ORDER_STATUS.CANCELLED,
      timestamp: new Date().toISOString(),
    });

    await recordAudit({
      actor: req.user,
      action: AUDIT.ORDER_CANCELLED,
      entityType: 'order',
      entityId: order.ticketId,
      summary: `${order.ticketId} cancelled by admin`,
      metadata: { reason },
      req,
    });

    res.json({ success: true, refundRequired: order.paymentStatus === 'paid' && order.paymentMethod === 'paystack' });
  } catch (error) {
    next(error);
  }
});

/* ---------------------------------------------------------------- riders */

/** Riders, with live availability. Never includes password hashes. */
router.get('/riders', async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.role, 'rider'))
      .orderBy(desc(users.isOnline), desc(users.totalDeliveries));

    res.json({ riders: rows.map(adminUser) });
  } catch (error) {
    next(error);
  }
});

/** Riders free to take a job right now — powers the assignment picker. */
router.get('/riders/available', async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'rider'), eq(users.status, 'active'), eq(users.isOnline, true)))
      .orderBy(asc(users.isBusy), desc(users.totalDeliveries));

    res.json({ riders: rows.map(adminUser) });
  } catch (error) {
    next(error);
  }
});

/** Suspend or reactivate a rider. */
router.put(
  '/rider/:riderId/status',
  validateUuidParam('riderId'),
  validateBody(accountStatusSchema),
  async (req, res, next) => {
    try {
      const [rider] = await db.select().from(users).where(eq(users.id, req.params.riderId)).limit(1);
      if (!rider || rider.role !== 'rider') {
        return res.status(404).json({ error: 'Rider not found' });
      }

      // Don't strand a live delivery with a suspended rider.
      if (req.body.status === 'suspended') {
        const [{ count }] = await db
          .select({ count: sql`COUNT(*)::int` })
          .from(orders)
          .where(and(eq(orders.assignedRiderId, rider.id), inArray(orders.status, OPEN_STATUSES)));

        if (Number(count) > 0) {
          return res.status(409).json({
            error: 'This rider still has an active delivery. Reassign it before suspending them.',
          });
        }
      }

      await db
        .update(users)
        .set({ status: req.body.status, isOnline: false, updatedAt: new Date() })
        .where(eq(users.id, rider.id));

      await recordAudit({
        actor: req.user,
        action: AUDIT.ACCOUNT_STATUS,
        entityType: 'user',
        entityId: rider.id,
        summary: `${rider.username} set to ${req.body.status}`,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/* -------------------------------------------------------------- accounts */

/**
 * Credential management.
 *
 * Admins can see which accounts exist, disable them, and issue a one-time
 * password reset. Password hashes are never returned and existing passwords are
 * never recoverable — a reset mints a new value and forces a change at next
 * sign-in.
 */
router.get('/accounts', async (req, res, next) => {
  try {
    // A plain admin manages riders; only a super admin sees other admins.
    const visibleRoles = req.user.role === 'super_admin' ? ['super_admin', 'admin', 'rider'] : ['rider', 'admin'];

    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.role, visibleRoles))
      .orderBy(asc(users.role), asc(users.username));

    res.json({
      accounts: rows.map((u) => ({
        ...adminUser(u),
        isSelf: u.id === req.user.id,
        // A plain admin cannot act on admins or super admins.
        manageable:
          req.user.role === 'super_admin' ? u.id !== req.user.id : u.role === 'rider',
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** Issue a new password for another account. */
router.post(
  '/accounts/:userId/reset-password',
  validateUuidParam('userId'),
  validateBody(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const [target] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
      if (!target) return res.status(404).json({ error: 'Account not found' });

      if (target.id === req.user.id) {
        return res.status(400).json({
          error: 'Use "Change my password" to update your own credentials',
        });
      }

      // Only a super admin may reset an admin or another super admin.
      if (target.role !== 'rider' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a super admin can reset an administrator password' });
      }

      const passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);

      await db
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: req.body.mustChangePassword ?? true,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, target.id));

      await recordAudit({
        actor: req.user,
        action: AUDIT.PASSWORD_RESET,
        entityType: 'user',
        entityId: target.id,
        summary: `${req.user.username} reset the password for ${target.username}`,
        req,
      });

      // Best-effort heads-up. The password itself is never emailed.
      if (target.email) {
        sendEmail({
          to: target.email,
          subject: 'Your Nize Logistics password was reset',
          html: `<h2>Password reset</h2>
                 <p>An administrator reset the password on your account (${target.username}).</p>
                 <p>They will share the new password with you directly. You will be asked to choose your own the next time you sign in.</p>`,
        }).catch((err) => console.error('[email] reset notice failed:', err.message));
      }

      res.json({
        success: true,
        message: `Password reset for ${target.username}. Share it securely — it is not stored in readable form.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/** Enable or disable any managed account. */
router.put(
  '/accounts/:userId/status',
  validateUuidParam('userId'),
  validateBody(accountStatusSchema),
  async (req, res, next) => {
    try {
      const [target] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
      if (!target) return res.status(404).json({ error: 'Account not found' });

      if (target.id === req.user.id) {
        return res.status(400).json({ error: 'You cannot disable your own account' });
      }
      if (target.role !== 'rider' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a super admin can disable an administrator' });
      }

      // Never let the last active super admin be locked out.
      if (target.role === 'super_admin' && req.body.status === 'suspended') {
        const [{ count }] = await db
          .select({ count: sql`COUNT(*)::int` })
          .from(users)
          .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active'), ne(users.id, target.id)));

        if (Number(count) === 0) {
          return res.status(409).json({ error: 'This is the last active super admin and cannot be disabled' });
        }
      }

      await db
        .update(users)
        .set({ status: req.body.status, isOnline: false, updatedAt: new Date() })
        .where(eq(users.id, target.id));

      await recordAudit({
        actor: req.user,
        action: AUDIT.ACCOUNT_STATUS,
        entityType: 'user',
        entityId: target.id,
        summary: `${target.username} set to ${req.body.status}`,
        req,
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/* --------------------------------------------------------------- invites */

router.get('/invites', async (req, res, next) => {
  try {
    const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(50);
    res.json({
      invites: rows.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        used: i.used,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        expired: new Date() > i.expiresAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/invite', validateBody(inviteSchema), async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super admin can invite administrators' });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // NOTE: the column is `created_by`; the old code wrote `invitedBy`, which
    // silently dropped the audit trail on every invite.
    const [invite] = await db
      .insert(invites)
      .values({ email, role, token, expiresAt, createdBy: req.user.id })
      .returning();

    const signupLink = `${process.env.FRONTEND_URL}/signup/${token}`;

    let emailed = true;
    try {
      await sendEmail({
        to: email,
        subject: `You have been invited to Nize Logistics`,
        html: `<h2>Welcome to Nize Logistics</h2>
               <p>You have been invited to join as a <strong>${role}</strong>.</p>
               <p><a href="${signupLink}">Complete your signup</a></p>
               <p>This link expires in 7 days.</p>`,
      });
    } catch (error) {
      // The invite is valid regardless — hand the link back so the admin can
      // deliver it another way instead of losing it to an SMTP outage.
      emailed = false;
      console.error('[email] invite delivery failed:', error.message);
    }

    await recordAudit({
      actor: req.user,
      action: AUDIT.INVITE_SENT,
      entityType: 'invite',
      entityId: invite.id,
      summary: `Invited ${email} as ${role}`,
      req,
    });

    res.status(201).json({
      invite: { id: invite.id, email, role, expiresAt },
      signupLink,
      emailed,
    });
  } catch (error) {
    next(error);
  }
});

/* --------------------------------------------------------------- reports */

router.get('/reports', async (req, res, next) => {
  try {
    const status = req.query.status;
    const where = status === 'open' || status === 'resolved' ? eq(reports.status, status) : undefined;

    const rows = await db
      .select({
        report: reports,
        ticketId: orders.ticketId,
        orderStatus: orders.status,
      })
      .from(reports)
      .leftJoin(orders, eq(reports.orderId, orders.id))
      .where(where)
      .orderBy(desc(reports.createdAt))
      .limit(100);

    res.json({
      reports: rows.map((r) => ({ ...r.report, ticketId: r.ticketId, orderStatus: r.orderStatus })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reports/:reportId/resolve', validateUuidParam('reportId'), async (req, res, next) => {
  try {
    const notes = String(req.body?.notes ?? '').trim().slice(0, 2000) || null;

    const [updated] = await db
      .update(reports)
      .set({ status: 'resolved', resolutionNotes: notes, resolvedAt: new Date(), resolvedBy: req.user.id })
      .where(eq(reports.id, req.params.reportId))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Report not found' });

    await recordAudit({
      actor: req.user,
      action: AUDIT.REPORT_RESOLVED,
      entityType: 'report',
      entityId: updated.id,
      summary: `Resolved a ${updated.type} report`,
      req,
    });

    res.json({ success: true, report: updated });
  } catch (error) {
    next(error);
  }
});

/* --------------------------------------------------------------- pricing */

router.get('/pricing', async (req, res, next) => {
  try {
    const [pricing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1)).limit(1);
    res.json({
      pricing: pricing ?? { id: 1, baseFare: '500', perKmRate: '120', minimumFare: '1000' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update fare settings.
 *
 * All three values are required. The old handler wrote `value || null` into
 * NOT NULL columns, so saving one field wiped the others and failed.
 */
router.put('/pricing', validateBody(pricingSchema), async (req, res, next) => {
  try {
    const { baseFare, perKmRate, minimumFare } = req.body;
    const values = {
      baseFare: baseFare.toFixed(2),
      perKmRate: perKmRate.toFixed(2),
      minimumFare: minimumFare.toFixed(2),
      updatedAt: new Date(),
    };

    // The row may not exist on a fresh database.
    const [existing] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 1)).limit(1);
    if (existing) {
      await db.update(pricingConfig).set(values).where(eq(pricingConfig.id, 1));
    } else {
      await db.insert(pricingConfig).values({ id: 1, ...values });
    }

    await recordAudit({
      actor: req.user,
      action: AUDIT.PRICING_UPDATED,
      entityType: 'pricing',
      entityId: '1',
      summary: `Fares updated: base ₦${baseFare}, ₦${perKmRate}/km, minimum ₦${minimumFare}`,
      req,
    });

    res.json({ success: true, pricing: values });
  } catch (error) {
    next(error);
  }
});

/* ----------------------------------------------------------- audit trail */

router.get('/audit', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { logs, total } = await listAudit({ page, limit, action: req.query.action });
    res.json({ logs, pagination: { page, limit, total } });
  } catch (error) {
    next(error);
  }
});

export default router;
