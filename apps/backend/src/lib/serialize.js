/**
 * Response serializers.
 *
 * Routes must never hand a raw database row to the client. `SELECT *` on the
 * users table carries password_hash and push_subscription; platform_settings
 * carries live Paystack, SMTP and VAPID secrets. Everything that leaves the API
 * goes through one of these allow-lists.
 */

/** Public-facing rider/staff profile. Safe for any authenticated caller. */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    phone: user.phone,
    whatsapp: user.whatsapp,
    plateNumber: user.plateNumber,
    vehicleType: user.vehicleType,
    profilePhotoUrl: user.profilePhotoUrl,
    isOnline: user.isOnline,
    isBusy: user.isBusy,
    lastSeen: user.lastSeen,
    totalDeliveries: user.totalDeliveries,
    totalAmount: user.totalAmount,
    mustChangePassword: user.mustChangePassword ?? false,
    createdAt: user.createdAt,
  };
}

/** Admin view — adds live location and suspension detail, still no secrets. */
export function adminUser(user) {
  if (!user) return null;
  return {
    ...publicUser(user),
    suspendedUntil: user.suspendedUntil,
    currentLat: user.currentLat,
    currentLng: user.currentLng,
    hasPushSubscription: !!user.pushSubscription,
    updatedAt: user.updatedAt,
  };
}

/**
 * Only what the public tracking page needs. Deliberately omits sender/recipient
 * phone numbers and internal notes — a 6-character ticket id is guessable, so
 * this endpoint must not expose contact details.
 */
export function trackingOrder(order) {
  if (!order) return null;
  return {
    ticketId: order.ticketId,
    status: order.status,
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    pickupLat: order.pickupLat,
    pickupLng: order.pickupLng,
    dropoffLat: order.dropoffLat,
    dropoffLng: order.dropoffLng,
    senderName: order.senderName,
    recipientName: order.recipientName,
    distanceKm: order.distanceKm,
    totalPrice: order.totalPrice,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    assignedAt: order.assignedAt,
    acceptedAt: order.acceptedAt,
    pickedUpAt: order.pickedUpAt,
    inTransitAt: order.inTransitAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    estimatedDeliveryTime: order.estimatedDeliveryTime,
  };
}

/** Rider-facing job view — includes the contact details a rider needs on the road. */
export function riderOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    ticketId: order.ticketId,
    status: order.status,
    pickupType: order.pickupType,
    scheduledPickupAt: order.scheduledPickupAt,
    pickupAddress: order.pickupAddress,
    pickupLat: order.pickupLat,
    pickupLng: order.pickupLng,
    dropoffAddress: order.dropoffAddress,
    dropoffLat: order.dropoffLat,
    dropoffLng: order.dropoffLng,
    senderName: order.senderName,
    senderPhone: order.senderPhone,
    senderWhatsapp: order.senderWhatsapp,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    recipientWhatsapp: order.recipientWhatsapp,
    recipientEmail: order.recipientEmail,
    packageImages: order.packageImages,
    description: order.description,
    notes: order.notes,
    distanceKm: order.distanceKm,
    totalPrice: order.totalPrice,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    cashCollected: order.cashCollected,
    deliveryProofUrl: order.deliveryProofUrl,
    deliveryNotes: order.deliveryNotes,
    estimatedDeliveryTime: order.estimatedDeliveryTime,
    assignedAt: order.assignedAt,
    acceptedAt: order.acceptedAt,
    pickedUpAt: order.pickedUpAt,
    inTransitAt: order.inTransitAt,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
  };
}

/** Admin order view — everything the rider sees plus operational metadata. */
export function adminOrder(order) {
  if (!order) return null;
  return {
    ...riderOrder(order),
    assignedRiderId: order.assignedRiderId,
    paymentReference: order.paymentReference,
    declinedCount: order.declinedCount,
    cancellationReason: order.cancellationReason,
    cancelledAt: order.cancelledAt,
    isPruned: order.isPruned,
    updatedAt: order.updatedAt,
  };
}

/**
 * Platform settings with every credential replaced by a boolean.
 * The UI only needs to know whether a key is configured, never its value.
 */
export function safeSettings(settings) {
  if (!settings) return {};
  return {
    emailService: settings.emailService,
    emailFrom: settings.emailFrom,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    cloudinaryCloudName: settings.cloudinaryCloudName,
    paystackPublicKey: settings.paystackPublicKey,
    vapidPublicKey: settings.vapidPublicKey,
    vapidSubject: settings.vapidSubject,
    pruningEnabled: settings.pruningEnabled,
    daysToKeepImages: settings.daysToKeepImages,
    daysToKeepFull: settings.daysToKeepFull,
    scheduledPickupNoticeMinutes: settings.scheduledPickupNoticeMinutes,
    declinedAlertThreshold: settings.declinedAlertThreshold,
    autoOfflineMinutes: settings.autoOfflineMinutes,
    recipientLinkActiveDays: settings.recipientLinkActiveDays,
    maintenanceMode: settings.maintenanceMode ?? false,
    maintenanceMessage: settings.maintenanceMessage,
    updatedAt: settings.updatedAt,
    // Presence flags instead of the secrets themselves.
    hasResendApiKey: !!settings.resendApiKey,
    hasSmtpPass: !!settings.smtpPass,
    hasCloudinaryApiSecret: !!settings.cloudinaryApiSecret,
    hasPaystackSecretKey: !!settings.paystackSecretKey,
    hasVapidPrivateKey: !!settings.vapidPrivateKey,
  };
}
