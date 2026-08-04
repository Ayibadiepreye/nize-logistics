import { pgTable, uuid, text, timestamp, boolean, decimal, integer, jsonb, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============== ENUMS ===============
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'rider']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'pending_signup']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled']);
export const pickupTypeEnum = pgEnum('pickup_type', ['immediate', 'scheduled']);
export const paymentMethodEnum = pgEnum('payment_method', ['paystack', 'cod']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'refunded']);
export const emailServiceEnum = pgEnum('email_service', ['resend', 'smtp']);

// =============== USERS ===============
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').default('pending_signup').notNull(),
  suspendedUntil: timestamp('suspended_until'),
  
  // Rider-specific
  fullName: text('full_name'),
  phone: varchar('phone', { length: 20 }),
  whatsapp: varchar('whatsapp', { length: 20 }),
  plateNumber: varchar('plate_number', { length: 20 }),
  vehicleType: varchar('vehicle_type', { length: 50 }),
  profilePhotoUrl: text('profile_photo_url'),
  
  // Live status
  isOnline: boolean('is_online').default(false),
  isBusy: boolean('is_busy').default(false),
  currentLat: decimal('current_lat', { precision: 10, scale: 7 }),
  currentLng: decimal('current_lng', { precision: 10, scale: 7 }),
  lastSeen: timestamp('last_seen'),
  
  // VAPID
  pushSubscription: jsonb('push_subscription'),
  
  // Stats
  totalDeliveries: integer('total_deliveries').default(0),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============== INVITES ===============
export const invites = pgTable('invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  token: text('token').unique().notNull(),
  role: userRoleEnum('role').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =============== ORDERS ===============
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: varchar('ticket_id', { length: 20 }).unique().notNull(),
  
  // Pickup
  pickupType: pickupTypeEnum('pickup_type').notNull(),
  scheduledPickupAt: timestamp('scheduled_pickup_at'),
  pickupAddress: text('pickup_address').notNull(),
  pickupLat: decimal('pickup_lat', { precision: 10, scale: 7 }).notNull(),
  pickupLng: decimal('pickup_lng', { precision: 10, scale: 7 }).notNull(),
  
  // Drop-off
  dropoffAddress: text('dropoff_address').notNull(),
  dropoffLat: decimal('dropoff_lat', { precision: 10, scale: 7 }).notNull(),
  dropoffLng: decimal('dropoff_lng', { precision: 10, scale: 7 }).notNull(),
  
  // People
  senderName: varchar('sender_name', { length: 100 }).notNull(),
  senderPhone: varchar('sender_phone', { length: 20 }).notNull(),
  senderWhatsapp: varchar('sender_whatsapp', { length: 20 }),
  recipientName: varchar('recipient_name', { length: 100 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
  recipientWhatsapp: varchar('recipient_whatsapp', { length: 20 }),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  
  // Package
  packageImages: jsonb('package_images').$type().default([]),
  description: text('description'),
  notes: text('notes'),
  
  // Pricing
  distanceKm: decimal('distance_km', { precision: 8, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  
  // Payment
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  paymentReference: text('payment_reference'),
  cashCollected: boolean('cash_collected').default(false),
  
  // Status
  status: orderStatusEnum('status').default('pending').notNull(),
  assignedRiderId: uuid('assigned_rider_id').references(() => users.id),
  assignedAt: timestamp('assigned_at'),
  pickedUpAt: timestamp('picked_up_at'),
  inTransitAt: timestamp('in_transit_at'),
  deliveredAt: timestamp('delivered_at'),
  deliveryProofUrl: text('delivery_proof_url'),
  deliveryNotes: text('delivery_notes'),
  estimatedDeliveryTime: timestamp('estimated_delivery_time'),
  acceptedAt: timestamp('accepted_at'),
  declinedCount: integer('declined_count').default(0),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at'),
  
  // Recipient link
  recipientToken: text('recipient_token').unique(),
  recipientLinkExpiresAt: timestamp('recipient_link_expires_at'),
  
  // Pruning
  textSnapshot: text('text_snapshot'),
  isPruned: boolean('is_pruned').default(false),
  imagesPrunedAt: timestamp('images_pruned_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============== REPORTS ===============
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  reporterRole: userRoleEnum('reporter_role').notNull(),
  reporterId: uuid('reporter_id').references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =============== PRICING CONFIG ===============
export const pricingConfig = pgTable('pricing_config', {
  id: integer('id').primaryKey().default(1),
  baseFare: decimal('base_fare', { precision: 12, scale: 2 }).default('500').notNull(),
  perKmRate: decimal('per_km_rate', { precision: 12, scale: 2 }).default('120').notNull(),
  minimumFare: decimal('minimum_fare', { precision: 12, scale: 2 }).default('1000').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============== PLATFORM SETTINGS ===============
export const platformSettings = pgTable('platform_settings', {
  id: integer('id').primaryKey().default(1),
  emailService: emailServiceEnum('email_service').default('resend').notNull(),
  resendApiKey: text('resend_api_key'),
  smtpHost: varchar('smtp_host', { length: 255 }),
  smtpPort: integer('smtp_port'),
  smtpUser: varchar('smtp_user', { length: 255 }),
  smtpPass: text('smtp_pass'),
  emailFrom: varchar('email_from', { length: 255 }).default('Nize Logistics <noreply@nizelogistics.com>'),
  cloudinaryCloudName: varchar('cloudinary_cloud_name', { length: 255 }),
  cloudinaryApiKey: varchar('cloudinary_api_key', { length: 255 }),
  cloudinaryApiSecret: text('cloudinary_api_secret'),
  paystackSecretKey: text('paystack_secret_key'),
  paystackPublicKey: varchar('paystack_public_key', { length: 255 }),
  vapidPublicKey: text('vapid_public_key'),
  vapidPrivateKey: text('vapid_private_key'),
  vapidSubject: varchar('vapid_subject', { length: 255 }).default('mailto:admin@nizelogistics.com'),
  pruningEnabled: boolean('pruning_enabled').default(true),
  daysToKeepImages: integer('days_to_keep_images').default(30),
  daysToKeepFull: integer('days_to_keep_full').default(90),
  scheduledPickupNoticeMinutes: integer('scheduled_pickup_notice_minutes').default(30),
  declinedAlertThreshold: integer('declined_alert_threshold').default(3),
  autoOfflineMinutes: integer('auto_offline_minutes').default(2),
  recipientLinkActiveDays: integer('recipient_link_active_days').default(2),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============== RELATIONS ===============
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  reports: many(reports),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  assignedRider: one(users, { fields: [orders.assignedRiderId], references: [users.id] }),
  reports: many(reports),
}));
