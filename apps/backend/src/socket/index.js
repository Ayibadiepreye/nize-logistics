import jwt from 'jsonwebtoken';
import { db } from '../lib/db/index.js';
import { users } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

const connectedUsers = new Map(); // userId -> socket

export function setupSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.userId} (${socket.userRole})`);
    connectedUsers.set(socket.userId, socket);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Join role-based room
    socket.join(`role:${socket.userRole}`);

    // Rider location update
    socket.on('rider:location', async (data) => {
      if (socket.userRole !== 'rider') return;

      const { lat, lng, orderId } = data;

      // Update rider location in database
      await db.update(users)
        .set({ currentLat: lat, currentLng: lng, lastSeen: new Date() })
        .where(eq(users.id, socket.userId));

      // Broadcast to order room if rider is on a delivery
      if (orderId) {
        io.to(`order:${orderId}`).emit('rider:location-update', {
          riderId: socket.userId,
          lat,
          lng,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Join order room (for tracking)
    socket.on('order:subscribe', (orderId) => {
      socket.join(`order:${orderId}`);
      console.log(`User ${socket.userId} subscribed to order ${orderId}`);
    });

    // Leave order room
    socket.on('order:unsubscribe', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);
    });
  });

  console.log('📡 Socket.io event handlers registered');
}

// Helper to emit to specific user
export function emitToUser(io, userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
}

// Helper to emit to all admins
export function emitToAdmins(io, event, data) {
  io.to('role:admin').to('role:super_admin').emit(event, data);
}

// Helper to emit to order room
export function emitToOrder(io, orderId, event, data) {
  io.to(`order:${orderId}`).emit(event, data);
}
