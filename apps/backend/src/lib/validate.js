import { z } from 'zod';
import { ORDER_STATUSES } from './orderStatus.js';

/**
 * Request validation.
 *
 * Every mutating endpoint runs its body through a schema before touching the
 * database. Previously a missing latitude produced `NaN` that reached a NOT NULL
 * decimal column as a 500; now it is a 400 that says which field is wrong.
 */

/* ------------------------------------------------------------- primitives */

/** Nigerian mobile numbers, accepting 080…, +23480… and 23480… forms. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .regex(/^[+]?[0-9\s()-]{7,20}$/, 'Enter a valid phone number');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(255);

export const latSchema = z.coerce
  .number({ invalid_type_error: 'Latitude must be a number' })
  .min(-90, 'Latitude out of range')
  .max(90, 'Latitude out of range');

export const lngSchema = z.coerce
  .number({ invalid_type_error: 'Longitude must be a number' })
  .min(-180, 'Longitude out of range')
  .max(180, 'Longitude out of range');

/**
 * Passwords: length is the requirement that actually matters, plus a mixed-case
 * or digit rule so demo credentials can't be a single repeated character.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'Password must contain at least one letter and one number',
  });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(/^[a-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores');

/* ----------------------------------------------------------------- schemas */

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().min(1).max(255).optional(),
  password: z.string().min(1, 'Password is required').max(128),
}).refine((v) => v.username || v.email, {
  message: 'Username or email is required',
  path: ['email'],
});

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional().or(z.literal('')),
  plateNumber: z.string().trim().max(20).optional().or(z.literal('')),
  vehicleType: z.string().trim().max(50).optional().or(z.literal('')),
});

export const createOrderSchema = z.object({
  pickupType: z.enum(['immediate', 'scheduled']),
  scheduledPickupAt: z.coerce.date().optional().nullable(),
  pickupAddress: z.string().trim().min(5, 'Pickup address is required').max(500),
  pickupLat: latSchema,
  pickupLng: lngSchema,
  dropoffAddress: z.string().trim().min(5, 'Drop-off address is required').max(500),
  dropoffLat: latSchema,
  dropoffLng: lngSchema,
  senderName: z.string().trim().min(2, 'Sender name is required').max(100),
  senderPhone: phoneSchema,
  senderWhatsapp: phoneSchema.optional().or(z.literal('')),
  recipientName: z.string().trim().min(2, 'Recipient name is required').max(100),
  recipientPhone: phoneSchema,
  recipientWhatsapp: phoneSchema.optional().or(z.literal('')),
  recipientEmail: emailSchema.optional().or(z.literal('')),
  packageImages: z.array(z.string().url()).max(5).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  paymentMethod: z.enum(['paystack', 'cod']),
}).superRefine((val, ctx) => {
  if (val.pickupType === 'scheduled') {
    if (!val.scheduledPickupAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledPickupAt'],
        message: 'Pick a date and time for a scheduled pickup',
      });
    } else if (val.scheduledPickupAt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledPickupAt'],
        message: 'Scheduled pickup cannot be in the past',
      });
    }
  }
});

export const updateOrderSchema = z.object({
  pickupAddress: z.string().trim().min(5).max(500).optional(),
  dropoffAddress: z.string().trim().min(5).max(500).optional(),
  senderPhone: phoneSchema.optional(),
  recipientPhone: phoneSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  scheduledPickupAt: z.coerce.date().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No changes supplied' });

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  // Proves ownership of an anonymously-placed order (admins don't need it).
  senderPhone: phoneSchema.optional(),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(['rider', 'admin']),
});

export const pricingSchema = z.object({
  baseFare: z.coerce.number().min(0).max(1_000_000),
  perKmRate: z.coerce.number().min(0).max(1_000_000),
  minimumFare: z.coerce.number().min(0).max(1_000_000),
});

export const assignOrderSchema = z.object({
  riderId: z.string().uuid('Select a rider'),
});

export const orderQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  riderId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['createdAt', 'totalPrice', 'status', 'deliveredAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  mustChangePassword: z.boolean().optional().default(true),
});

export const accountStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional().or(z.literal('')),
  plateNumber: z.string().trim().max(20).optional().or(z.literal('')),
  vehicleType: z.string().trim().max(50).optional().or(z.literal('')),
  profilePhotoUrl: z.string().url().max(500).optional().or(z.literal('')),
});

export const riderStatusUpdateSchema = z.object({
  estimatedDeliveryTime: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  deliveryProofUrl: z.string().url().max(500).optional().or(z.literal('')),
  cashCollected: z.boolean().optional(),
});

export const reportSchema = z.object({
  type: z.enum(['damaged', 'missing', 'wrong_item', 'late', 'other']),
  description: z.string().trim().min(5, 'Please describe the issue').max(2000),
});

export const settingsSchema = z.object({
  pruningEnabled: z.boolean().optional(),
  daysToKeepImages: z.coerce.number().int().min(1).max(3650).optional(),
  daysToKeepFull: z.coerce.number().int().min(1).max(3650).optional(),
  autoOfflineMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  scheduledPickupNoticeMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  declinedAlertThreshold: z.coerce.number().int().min(1).max(100).optional(),
  recipientLinkActiveDays: z.coerce.number().int().min(1).max(365).optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(500).optional().or(z.literal('')),
});

/* -------------------------------------------------------------- middleware */

function formatIssues(error) {
  return error.issues.map((i) => ({
    field: i.path.join('.') || undefined,
    message: i.message,
  }));
}

/** Validates and REPLACES req.body with the parsed (coerced, trimmed) value. */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({
        error: result.error.issues[0]?.message || 'Invalid request',
        details: formatIssues(result.error),
      });
    }
    req.body = result.data;
    next();
  };
}

/** Same for query strings; parsed output lands on req.query. */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      return res.status(400).json({
        error: result.error.issues[0]?.message || 'Invalid query',
        details: formatIssues(result.error),
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

/** Guards `:id`-style route params that go straight into a WHERE clause. */
export function validateUuidParam(name) {
  return (req, res, next) => {
    const value = req.params[name];
    if (!z.string().uuid().safeParse(value).success) {
      return res.status(400).json({ error: 'Invalid identifier' });
    }
    next();
  };
}
