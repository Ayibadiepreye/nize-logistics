import jwt from 'jsonwebtoken';
import { db } from '../lib/db/index.js';
import { users } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Authentication and authorisation.
 *
 * The role is always re-read from the database on every request. Nothing here
 * trusts a role claim carried in the JWT or sent by the client, so a user
 * suspended or demoted mid-session loses access on their next call.
 */

function bearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length ? token : null;
}

export async function authenticate(req, res, next) {
  try {
    const token = bearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      }
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account is suspended' });
    }

    if (user.status === 'pending_signup') {
      return res.status(403).json({ error: 'This account has not completed signup' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches req.user when a valid token is present, but never rejects. */
export async function optionalAuth(req, res, next) {
  try {
    const token = bearerToken(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      if (user && user.status === 'active') {
        req.user = user;
      }
    }
  } catch {
    // An invalid token on an optional route is simply an anonymous request.
  }
  next();
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }

    next();
  };
}

export const requireAdmin = requireRole(['admin', 'super_admin']);
export const requireSuperAdmin = requireRole(['super_admin']);
export const requireRider = requireRole(['rider']);

/**
 * Blocks normal work while a password reset is outstanding. The account can
 * still read its own profile and set a new password, nothing else.
 */
export function blockIfPasswordResetPending(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(428).json({
      error: 'Your password was reset by an administrator. Set a new password to continue.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
  next();
}
