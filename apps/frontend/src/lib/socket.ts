import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

let socket: Socket | null = null;

/**
 * Initialize authenticated socket connection (for riders/admins)
 */
export function initSocket(token: string) {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber: number) => {
    console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
  });

  return socket;
}

/**
 * Initialize public socket connection for tracking (no auth required)
 */
export function initPublicSocket() {
  // Reuse existing socket if available
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    // No auth token — backend allows guest connections for tracking
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('✅ Public socket connected (tracking)');
  });

  socket.on('disconnect', () => {
    console.log('❌ Public socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Public socket error:', error.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { initSocket, initPublicSocket, getSocket, disconnectSocket };
