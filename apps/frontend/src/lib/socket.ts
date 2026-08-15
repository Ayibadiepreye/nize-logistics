import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Returns the shared socket, creating it on first use.
 *
 * Passing no token opens an anonymous connection, which the server allows so
 * the public tracking page can receive live updates. The previous version
 * returned a stale socket whenever `connected` was momentarily false, which
 * left dashboards stacking duplicate listeners on every re-render.
 */
export function getSocket(token?: string | null): Socket {
  const authToken = token ?? getToken();

  // Rebuild if the identity changed (sign-in, sign-out, account switch).
  if (socket && currentToken !== authToken) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    currentToken = authToken;
    socket = io(SOCKET_URL, {
      auth: authToken ? { token: authToken } : {},
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
    });

    socket.on('connect_error', (error) => {
      console.warn('[socket] connection error:', error.message);
    });
  }

  return socket;
}

/** Backwards-compatible alias. */
export function initSocket(token: string): Socket {
  return getSocket(token);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

export default { initSocket, getSocket, disconnectSocket };
