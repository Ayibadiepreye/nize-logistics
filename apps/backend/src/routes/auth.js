import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db/index.js';
import { users, invites } from '../lib/db/schema.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { generateToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { publicUser } from '../lib/serialize.js';
import { AUDIT, recordAudit } from '../lib/audit.js';
import {
  validateBody,
  loginSchema,
  signupSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../lib/validate.js';

const router = express.Router();

const BCRYPT_ROUNDS = 12;

/**
 * Sign in with username or email.
 *
 * Both lookups are case-insensitive: signup lowercases the username but stored
 * emails may carry mixed case, so matching on lower(email) avoids the class of
 * "my password stopped working" reports caused by a capitalised address.
 */
router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const identifier = (username || email || '').trim().toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(sql`lower(${users.email})`, identifier), eq(users.username, identifier)))
      .limit(1);

    // Compare against a dummy hash when the user is missing so the response
    // time doesn't reveal whether an account exists.
    const hash = user?.passwordHash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      await recordAudit({
        actor: null,
        action: AUDIT.LOGIN_FAILED,
        entityType: 'user',
        entityId: identifier,
        summary: `Failed sign-in for "${identifier}"`,
        req,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account is suspended. Contact an administrator.' });
    }

    if (user.status === 'pending_signup') {
      return res.status(403).json({ error: 'This account has not completed signup yet.' });
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    await recordAudit({
      actor: user,
      action: AUDIT.LOGIN,
      entityType: 'user',
      entityId: user.id,
      summary: `${user.username} signed in`,
      req,
    });

    res.json({
      token: generateToken(user.id),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/** Complete signup from an emailed invite token. */
router.post('/signup/:token', validateBody(signupSchema), async (req, res, next) => {
  try {
    const { token } = req.params;
    const { username, email, password, fullName, phone, whatsapp, plateNumber, vehicleType } = req.body;

    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.token, token), eq(invites.used, false)))
      .limit(1);

    if (!invite) {
      return res.status(400).json({ error: 'This invite is invalid or has already been used' });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'This invite has expired. Ask an admin for a new one.' });
    }

    if (invite.email.trim().toLowerCase() !== email) {
      return res.status(400).json({ error: 'Email does not match the invited address' });
    }

    // Check username AND email up front — relying on the unique constraint
    // turned a duplicate address into an opaque 500.
    const [existing] = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.username, username), eq(sql`lower(${users.email})`, email)))
      .limit(1);

    if (existing) {
      return res.status(409).json({
        error: existing.username === username ? 'That username is taken' : 'An account with that email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        role: invite.role,
        status: 'active',
        fullName,
        phone,
        whatsapp: whatsapp || null,
        plateNumber: invite.role === 'rider' ? plateNumber || null : null,
        vehicleType: invite.role === 'rider' ? vehicleType || null : null,
        passwordChangedAt: new Date(),
      })
      .returning();

    await db.update(invites).set({ used: true }).where(eq(invites.id, invite.id));

    await recordAudit({
      actor: newUser,
      action: AUDIT.ACCOUNT_CREATED,
      entityType: 'user',
      entityId: newUser.id,
      summary: `${newUser.username} completed signup as ${newUser.role}`,
      req,
    });

    res.status(201).json({
      token: generateToken(newUser.id),
      user: publicUser(newUser),
    });
  } catch (error) {
    next(error);
  }
});

/** Current session. */
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/**
 * Change your own password.
 *
 * This is the only way any password changes for the account that owns it —
 * admins can reset another account's password, but never read or set one they
 * then hand over in plaintext beyond the one-time value.
 */
router.post('/change-password', authenticate, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Your current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Choose a password different from your current one' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id));

    await recordAudit({
      actor: req.user,
      action: AUDIT.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: req.user.id,
      summary: `${req.user.username} changed their own password`,
      req,
    });

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

/** Update your own profile details. */
router.patch('/profile', authenticate, validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    // Empty strings from optional form fields mean "clear this".
    for (const key of ['whatsapp', 'plateNumber', 'vehicleType', 'profilePhotoUrl']) {
      if (updates[key] === '') updates[key] = null;
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, req.user.id)).returning();

    res.json({ user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
});

/** Check an invite before rendering the signup form. */
router.get('/invite/:token', async (req, res, next) => {
  try {
    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.token, req.params.token), eq(invites.used, false)))
      .limit(1);

    if (!invite || new Date() > invite.expiresAt) {
      return res.status(404).json({ error: 'This invite is invalid or has expired' });
    }

    res.json({ email: invite.email, role: invite.role, expiresAt: invite.expiresAt });
  } catch (error) {
    next(error);
  }
});

export default router;
