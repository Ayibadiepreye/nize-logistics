import rateLimit from 'express-rate-limit';
import { clientIp } from '../lib/audit.js';

/**
 * Rate limits.
 *
 * The login endpoint previously accepted unlimited attempts, which made the
 * demo accounts trivially brute-forceable. Order creation is also limited so a
 * script cannot flood the dispatch queue.
 */

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIp(req) || 'unknown',
};

/** 10 sign-in attempts per 15 minutes per IP; successful logins don't count. */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

/** Order creation from the public booking form. */
export const createOrderLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many orders created from this connection. Please try again later.' },
});

/** Token-guessing protection for the public tracking and recipient endpoints. */
export const lookupLimiter = rateLimit({
  ...common,
  windowMs: 5 * 60 * 1000,
  limit: 100,
  message: { error: 'Too many lookups. Please slow down and try again shortly.' },
});

/** Blanket ceiling for everything else. */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 300,
  message: { error: 'Too many requests. Please slow down.' },
});
