import express from 'express';
import { db } from '../lib/db/index.js';
import { users, platformSettings } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all admins
router.get('/admins', authenticate, requireRole(['super_admin']), async (req, res, next) => {
  try {
    const admins = await db.select().from(users)
      .where(eq(users.role, 'admin'));

    res.json({ admins });
  } catch (error) {
    next(error);
  }
});

// Promote user to admin
router.post('/promote/:userId', authenticate, requireRole(['super_admin']), async (req, res, next) => {
  try {
    const { userId } = req.params;

    await db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Demote admin to regular user
router.post('/demote/:userId', authenticate, requireRole(['super_admin']), async (req, res, next) => {
  try {
    const { userId } = req.params;

    await db.update(users).set({ role: 'rider' }).where(eq(users.id, userId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Update platform settings
router.put('/settings', authenticate, requireRole(['super_admin']), async (req, res, next) => {
  try {
    const {
      pruningEnabled,
      daysToKeepImages,
      daysToKeepFull,
      autoOfflineMinutes,
      maintenanceMode,
      maintenanceMessage,
    } = req.body;

    await db.update(platformSettings).set({
      pruningEnabled,
      daysToKeepImages,
      daysToKeepFull,
      autoOfflineMinutes,
      maintenanceMode,
      maintenanceMessage,
    }).where(eq(platformSettings.id, 1));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get platform settings
router.get('/settings', authenticate, requireRole(['super_admin']), async (req, res, next) => {
  try {
    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));

    res.json({ settings: settings || {} });
  } catch (error) {
    next(error);
  }
});

export default router;
