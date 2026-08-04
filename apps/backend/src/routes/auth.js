import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db/index.js';
import { users, invites } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const identifier = username || email;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    // Try to find user by username or email
    const [user] = await db.select().from(users)
      .where(
        identifier.includes('@') 
          ? eq(users.email, identifier.toLowerCase())
          : eq(users.username, identifier.toLowerCase())
      );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Signup with invite token
router.post('/signup/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { username, email, password, fullName, phone, whatsapp, plateNumber, vehicleType } = req.body;

    // Validate invite
    const [invite] = await db.select().from(invites)
      .where(and(eq(invites.token, token), eq(invites.used, false)));

    if (!invite) {
      return res.status(400).json({ error: 'Invalid or expired invite' });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite expired' });
    }

    if (invite.email !== email) {
      return res.status(400).json({ error: 'Email does not match invite' });
    }

    // Validate input
    if (!username || !password || username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Check if username/email exists
    const [existing] = await db.select().from(users)
      .where(eq(users.username, username.toLowerCase()));

    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(users).values({
      username: username.toLowerCase(),
      email,
      passwordHash,
      role: invite.role,
      status: 'active',
      fullName,
      phone,
      whatsapp,
      plateNumber: invite.role === 'rider' ? plateNumber : null,
      vehicleType: invite.role === 'rider' ? vehicleType : null,
    }).returning();

    // Mark invite as used
    await db.update(invites).set({ used: true }).where(eq(invites.id, invite.id));

    const authToken = generateToken(newUser.id);

    res.json({
      token: authToken,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        fullName: newUser.fullName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      fullName: req.user.fullName,
      phone: req.user.phone,
      whatsapp: req.user.whatsapp,
      profilePhotoUrl: req.user.profilePhotoUrl,
      isOnline: req.user.isOnline,
      totalDeliveries: req.user.totalDeliveries,
      totalAmount: req.user.totalAmount,
    },
  });
});

// Check invite validity
router.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const [invite] = await db.select().from(invites)
      .where(and(eq(invites.token, token), eq(invites.used, false)));

    if (!invite || new Date() > invite.expiresAt) {
      return res.status(404).json({ error: 'Invalid or expired invite' });
    }

    res.json({
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
