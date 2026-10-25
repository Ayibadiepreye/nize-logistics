import { db } from './db/index.js';
import { auditLogs } from './db/schema.js';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * Append-only audit trail for privileged actions.
 *
 * Logging must never break the action it records, so every failure here is
 * swallowed and reported to stderr instead of bubbling up.
 */
export async function recordAudit({ actor, action, entityType, entityId, summary, metadata, req }) {
  try {
    await db.insert(auditLogs).values({
      actorId: actor?.id ?? null,
      actorLabel: actor ? `${actor.fullName || actor.username} (${actor.role})` : 'system',
      action,
      entityType: entityType ?? null,
      entityId: entityId ? String(entityId) : null,
      summary: summary ?? null,
      metadata: metadata ?? null,
      ipAddress: req ? clientIp(req) : null,
    });
  } catch (error) {
    console.error('[audit] failed to record action:', action, error.message);
  }
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim().slice(0, 60);
  }
  return (req.ip || req.socket?.remoteAddress || '').slice(0, 60);
}

export async function listAudit({ page = 1, limit = 50, action } = {}) {
  const offset = (page - 1) * limit;
  const where = action ? eq(auditLogs.action, action) : undefined;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql`COUNT(*)::int` })
    .from(auditLogs)
    .where(where);

  return { logs: rows, total: Number(count) || 0 };
}

/** Action names, kept in one place so the admin UI can filter on them. */
export const AUDIT = {
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET: 'auth.password_reset',
  ACCOUNT_STATUS: 'account.status_changed',
  ACCOUNT_ROLE: 'account.role_changed',
  ACCOUNT_CREATED: 'account.created',
  INVITE_SENT: 'invite.sent',
  ORDER_ASSIGNED: 'order.assigned',
  ORDER_UNASSIGNED: 'order.unassigned',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS: 'order.status_changed',
  REFUND: 'payment.refunded',
  PRICING_UPDATED: 'settings.pricing_updated',
  SETTINGS_UPDATED: 'settings.updated',
  REPORT_RESOLVED: 'report.resolved',
};
