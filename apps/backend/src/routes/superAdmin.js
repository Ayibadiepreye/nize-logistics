import express from 'express';
import { db } from '../lib/db/index.js';
import { users, platformSettings } from '../lib/db/schema.js';
import { and, eq, ne, sql } from 'drizzle-orm';
import { authenticate, requireSuperAdmin, blockIfPasswordResetPending } from '../middleware/auth.js';
import { adminUser, safeSettings } from '../lib/serialize.js';
import { AUDIT, recordAudit } from '../lib/audit.js';
import { validateBody, validateUuidParam, settingsSchema } from '../lib/validate.js';

const router = express.Router();

router.use(authenticate, requireSuperAdmin, blockIfPasswordResetPending);

/** All administrator accounts. */
router.get('/admins', async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(sql`${users.role} IN ('admin','super_admin')`);

    res.json({ admins: rows.map(adminUser) });
  } catch (error) {
    next(error);
  }
});

/** Promote an account to administrator. */
router.post('/promote/:userId', validateUuidParam('userId'), async (req, res, next) => {
  try {
    const [target] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
    if (!target) return res.status(404).json({ error: 'Account not found' });
    if (target.role === 'admin' || target.role === 'super_admin') {
      return res.status(409).json({ error: 'That account is already an administrator' });
    }

    await db.update(users).set({ role: 'admin', updatedAt: new Date() }).where(eq(users.id, target.id));

    await recordAudit({
      actor: req.user,
      action: AUDIT.ACCOUNT_ROLE,
      entityType: 'user',
      entityId: target.id,
      summary: `${target.username} promoted from ${target.role} to admin`,
      req,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Demote an administrator.
 *
 * The old handler flipped any user to 'rider' with no checks, which could strip
 * the last super admin and lock everyone out of the platform.
 */
router.post('/demote/:userId', validateUuidParam('userId'), async (req, res, next) => {
  try {
    const [target] = await db.select().from(users).where(eq(users.id, req.params.userId)).limit(1);
    if (!target) return res.status(404).json({ error: 'Account not found' });

    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot demote yourself' });
    }

    if (target.role === 'rider') {
      return res.status(409).json({ error: 'That account is already a rider' });
    }

    if (target.role === 'super_admin') {
      const [{ count }] = await db
        .select({ count: sql`COUNT(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active'), ne(users.id, target.id)));

      if (Number(count) === 0) {
        return res.status(409).json({ error: 'This is the last super admin and cannot be demoted' });
      }
    }

    await db.update(users).set({ role: 'rider', updatedAt: new Date() }).where(eq(users.id, target.id));

    await recordAudit({
      actor: req.user,
      action: AUDIT.ACCOUNT_ROLE,
      entityType: 'user',
      entityId: target.id,
      summary: `${target.username} demoted from ${target.role} to rider`,
      req,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Platform settings.
 *
 * Response goes through safeSettings(), which swaps every stored credential
 * (Paystack secret, SMTP password, VAPID private key) for a boolean. The old
 * handler returned the row verbatim and shipped live secrets to the browser.
 */
router.get('/settings', async (req, res, next) => {
  try {
    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    res.json({ settings: safeSettings(settings) });
  } catch (error) {
    next(error);
  }
});

/** Update operational settings. Credentials stay in environment variables. */
router.put('/settings', validateBody(settingsSchema), async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    if (updates.maintenanceMessage === '') updates.maintenanceMessage = null;

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'No settings supplied' });
    }

    const [existing] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    if (existing) {
      await db.update(platformSettings).set(updates).where(eq(platformSettings.id, 1));
    } else {
      await db.insert(platformSettings).values({ id: 1, ...updates });
    }

    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);

    await recordAudit({
      actor: req.user,
      action: AUDIT.SETTINGS_UPDATED,
      entityType: 'settings',
      entityId: '1',
      summary: `Updated: ${Object.keys(req.body).join(', ')}`,
      req,
    });

    res.json({ success: true, settings: safeSettings(settings) });
  } catch (error) {
    next(error);
  }
});

export default router;
