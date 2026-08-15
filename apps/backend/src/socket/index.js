import jwt from 'jsonwebtoken';
import { db } from '../lib/db/index.js';
import { users, orders } from '../lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { ACTIVE_RIDER_STATUSES } from '../lib/orderStatus.js';

/**
 * Realtime layer.
 *
 * Two classes of connection:
 *   - Authenticated staff (riders, admins) get their personal and role rooms.
 *   - Anonymous customers may connect and follow a single order, but only by
 *     presenting a ticket id that actually exists.
 *
 * Previously the handshake required a token, so the public tracking page could
 * never receive live updates at all; and any signed-in user could join any
 * order room just by guessing a UUID.
 */
export function setupSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // Anonymous connections are allowed — they simply have no rooms of their own.
    if (!token) {
      socket.isAnonymous = true;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

      if (!user || user.status !== 'active') {
        return next(new Error('Account is not active'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.isAnonymous = false;
      next();
    } catch {
      next(new Error('Invalid session token'));
    }
  });

  io.on('connection', (socket) => {
    if (!socket.isAnonymous) {
      socket.join(`user:${socket.userId}`);
      socket.join(`role:${socket.userRole}`);
    }

    /**
     * Rider position ping. Persisted so the admin map and tracking page can
     * show a last-known location, and relayed live to whoever is watching the
     * order.
     */
    socket.on('rider:location', async (data) => {
      if (socket.userRole !== 'rider') return;

      const lat = Number(data?.lat);
      const lng = Number(data?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      try {
        await db
          .update(users)
          .set({ currentLat: String(lat), currentLng: String(lng), lastSeen: new Date() })
          .where(eq(users.id, socket.userId));

        if (data?.orderId) {
          // Only broadcast a position for a job this rider actually holds.
          const [order] = await db
            .select({ id: orders.id, riderId: orders.assignedRiderId, status: orders.status })
            .from(orders)
            .where(eq(orders.id, data.orderId))
            .limit(1);

          if (order?.riderId === socket.userId && ACTIVE_RIDER_STATUSES.includes(order.status)) {
            io.to(`order:${order.id}`).emit('rider:location-update', {
              lat,
              lng,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.error('[socket] location update failed:', error.message);
      }
    });

    /**
     * Follow an order. Accepts a ticket id (public tracking page) or an order
     * id from staff, and always verifies the order exists before joining.
     */
    socket.on('order:subscribe', async (payload, ack) => {
      try {
        const raw = typeof payload === 'string' ? payload : (payload?.ticketId ?? payload?.orderId ?? '');
        const value = String(raw).trim();
        if (!value) return;

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

        const [order] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(isUuid ? eq(orders.id, value) : eq(sql`upper(${orders.ticketId})`, value.toUpperCase()))
          .limit(1);

        if (!order) {
          if (typeof ack === 'function') ack({ ok: false });
          return;
        }

        socket.join(`order:${order.id}`);
        if (typeof ack === 'function') ack({ ok: true, orderId: order.id });
      } catch (error) {
        console.error('[socket] subscribe failed:', error.message);
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    socket.on('order:unsubscribe', (orderId) => {
      if (orderId) socket.leave(`order:${orderId}`);
    });
  });

  console.log('📡 Socket.io handlers registered');
}

export function emitToUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToAdmins(io, event, data) {
  io.to('role:admin').to('role:super_admin').emit(event, data);
}

export function emitToOrder(io, orderId, event, data) {
  io.to(`order:${orderId}`).emit(event, data);
}
