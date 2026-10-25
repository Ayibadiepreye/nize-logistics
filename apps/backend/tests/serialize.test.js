import test from 'node:test';
import assert from 'node:assert/strict';
import { publicUser, adminUser, safeSettings, trackingOrder } from '../src/lib/serialize.js';

const USER_ROW = {
  id: 'u1',
  username: 'rider',
  email: 'rider@nizelogistics.com',
  passwordHash: '$2a$12$averysecrethashvalue',
  pushSubscription: { endpoint: 'https://push.example/abc', keys: { auth: 'secret' } },
  role: 'rider',
  status: 'active',
  fullName: 'Demo Rider',
  phone: '+2348039346596',
  currentLat: '4.8156',
  currentLng: '7.0498',
};

test('a serialised user never carries the password hash', () => {
  for (const view of [publicUser(USER_ROW), adminUser(USER_ROW)]) {
    assert.equal(view.passwordHash, undefined);
    assert.equal(JSON.stringify(view).includes('averysecrethash'), false);
  }
});

test('the raw push subscription is reduced to a boolean for admins', () => {
  const view = adminUser(USER_ROW);
  assert.equal(view.pushSubscription, undefined);
  assert.equal(view.hasPushSubscription, true);
});

test('the public user view withholds live location', () => {
  const view = publicUser(USER_ROW);
  assert.equal(view.currentLat, undefined);
  assert.equal(view.currentLng, undefined);
  // Admins running the dispatch map do need it.
  assert.equal(adminUser(USER_ROW).currentLat, '4.8156');
});

test('platform settings expose presence flags, never the credentials', () => {
  const view = safeSettings({
    paystackSecretKey: 'sk_live_realsecret',
    smtpPass: 'smtp-password',
    vapidPrivateKey: 'vapid-private',
    resendApiKey: '',
    cloudinaryApiSecret: 'cloudinary-secret',
    paystackPublicKey: 'pk_test_public',
    emailFrom: 'Nize <no-reply@nizelogistics.com>',
  });

  const serialised = JSON.stringify(view);
  for (const secret of ['sk_live_realsecret', 'smtp-password', 'vapid-private', 'cloudinary-secret']) {
    assert.equal(serialised.includes(secret), false, `${secret} leaked`);
  }

  assert.equal(view.hasPaystackSecretKey, true);
  assert.equal(view.hasSmtpPass, true);
  assert.equal(view.hasVapidPrivateKey, true);
  assert.equal(view.hasResendApiKey, false);
  // Public values are still returned — the UI needs them.
  assert.equal(view.paystackPublicKey, 'pk_test_public');
});

test('public tracking withholds contact details and internal notes', () => {
  const view = trackingOrder({
    ticketId: 'NIZ-ABC123',
    status: 'in_transit',
    senderName: 'Ngozi',
    senderPhone: '+2348076690185',
    recipientPhone: '+2348039346596',
    recipientEmail: 'someone@example.com',
    notes: 'Gate code 4455',
    description: 'Laptop',
    totalPrice: '2400.00',
  });

  assert.equal(view.senderPhone, undefined);
  assert.equal(view.recipientPhone, undefined);
  assert.equal(view.recipientEmail, undefined);
  assert.equal(view.notes, undefined);
  // Names and progress are fine — that is the point of the page.
  assert.equal(view.senderName, 'Ngozi');
  assert.equal(view.status, 'in_transit');
});

test('serialisers tolerate a missing row', () => {
  assert.equal(publicUser(null), null);
  assert.equal(adminUser(undefined), null);
  assert.equal(trackingOrder(null), null);
  assert.deepEqual(safeSettings(null), {});
});
