/**
 * Full end-to-end platform flow test.
 *
 * Walks every actor through every path and asserts on real HTTP responses:
 *
 *   1. super admin / admin / rider logins
 *   2. admin invites a rider, rider redeems the invite
 *   3. fare metrics read + write + restore
 *   4. immediate order   -> assigned -> accepted -> picked_up -> in_transit -> delivered
 *   5. scheduled order   -> created with scheduledFor
 *   6. rider rejection  -> decline returns order to pending, declinedCount + 1
 *   7. illegal jump      -> rider tries to deliver without pickup (expect 409)
 *   8. cancellation      -> pending order cancelled
 *   9. customer tracking -> ticket lookup + route geometry
 *  10. rider history     -> earnings accumulate
 *  11. concurrency       -> three orders in flight at once, no cross-talk
 *  12. audit trail       -> every action recorded
 *
 *   node flow-test.mjs
 */

const BASE = process.env.BASE || 'http://127.0.0.1:10000';

let passed = 0;
const failures = [];
const notes = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}, _attempt = 0) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // The API rate-limits on purpose (order creation is 20/hour, the blanket
  // ceiling 300/min). A test run that is re-executed during development can
  // legitimately exhaust a window, so back off and retry rather than report a
  // 429 as though the platform were broken.
  if (res.status === 429 && _attempt < 6) {
    const wait = 15000 * (_attempt + 1);
    process.stdout.write(`     (rate limited — waiting ${wait / 1000}s)\n`);
    await new Promise((r) => setTimeout(r, wait));
    return api(method, path, { token, body }, _attempt + 1);
  }

  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

const EMAIL = `flowtest${Date.now()}@nizelogistics.com`;

async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  return r.body?.token ? r.body.token : null;
}

async function main() {
  console.log(`\n=== FLOW TEST — ${BASE} ===\n`);

  // ---------- 1. Logins ----------
  console.log('1. AUTH');
  const superTok = await login('superadmin@nizelogistics.com', 'NizeSuper#2026');
  const adminTok = await login('admin@nizelogistics.com', 'NizeAdmin#2026');
  const riderTok = await login('rider2@nizelogistics.com', 'SarahRides#2026');
  check('super admin login', !!superTok);
  check('admin login', !!adminTok);
  check('rider login', !!riderTok);

  const badLogin = await api('POST', '/api/auth/login', {
    body: { email: 'admin@nizelogistics.com', password: 'wrong-password' },
  });
  check('wrong password rejected', badLogin.status === 401, `got ${badLogin.status}`);

  // ---------- 2. Invite -> signup ----------
  console.log('\n2. INVITE + SIGNUP');
  const invite = await api('POST', '/api/admin/invite', {
    token: adminTok,
    body: { email: EMAIL, role: 'rider', name: 'Flow Test Rider' },
  });
  check('invite created', invite.status === 201 || invite.status === 200, `got ${invite.status}`);
  check('invite says it emailed', invite.body?.emailed === true);
  // The token is not a top-level field — it rides in the signup URL.
  const signupLink = invite.body?.signupLink || '';
  const inviteToken = signupLink.split('/signup/')[1] || invite.body?.invite?.token;
  check('invite token returned', !!inviteToken, signupLink.slice(-24));

  const dupInvite = await api('POST', '/api/admin/invite', {
    token: adminTok,
    body: { email: EMAIL, role: 'rider' },
  });
  check('duplicate pending invite rejected', dupInvite.status === 409, `got ${dupInvite.status}`);

  const signup = await api('POST', `/api/auth/signup/${inviteToken}`, {
    body: {
      // Unique per run: a fixed username collides with the previous execution.
      username: `flowtest${Date.now().toString(36)}`,
      email: EMAIL,
      password: 'FlowTest#2026',
      fullName: 'Flow Test Rider',
      phone: '+2348055501928',
    },
  });
  check('signup from token', signup.status === 200 || signup.status === 201,
    `got ${signup.status} ${JSON.stringify(signup.body).slice(0, 120)}`);

  const reuse = await api('POST', `/api/auth/signup/${inviteToken}`, {
    body: { password: 'Again#2026', fullName: 'Reuse' },
  });
  check('invite token single-use', reuse.status === 400, `got ${reuse.status}`);

  // Signup lets the rider pick their own password, so there is no temporary
  // credential to rotate — it signs them straight in. The forced-change gate
  // exists for the *admin reset* path, where an admin picks a temp password.
  const newRiderTok = signup.body?.token;
  check('signup signs the rider straight in', !!newRiderTok);

  const newRider = await api('GET', '/api/auth/me', { token: newRiderTok });
  check('new rider has the invited role', newRider.body?.user?.role === 'rider',
    String(newRider.body?.user?.role));
  check('new rider starts with no deliveries',
    (newRider.body?.user?.totalDeliveries ?? 0) === 0);

  // Now the admin-reset path, which is where the gate actually applies.
  const newRiderRow = (await api('GET', '/api/admin/riders', { token: adminTok })).body;
  const newRiderList = Array.isArray(newRiderRow) ? newRiderRow : (newRiderRow.riders || []);
  const target = newRiderList.find((r) => r.email === EMAIL);

  const adminReset = await api('POST', `/api/admin/accounts/${target.id}/reset-password`, {
    token: adminTok,
    body: { newPassword: 'TempPass#2026' },
  });
  check('admin resets rider password', adminReset.status === 200, `got ${adminReset.status}`);

  const gatedLogin = await api('POST', '/api/auth/login', {
    body: { email: EMAIL, password: 'TempPass#2026' },
  });
  // The flag lives on the nested user object, not at the top level.
  check('rider gated after admin reset',
    gatedLogin.body?.user?.mustChangePassword === true,
    JSON.stringify(gatedLogin.body?.user || {}).slice(0, 120));

  const stillBlocked = await api('GET', '/api/rider/dashboard', {
    token: gatedLogin.body?.token,
  });
  // 428 Precondition Required is the deliberate status for this gate.
  check('gated rider cannot reach the dashboard',
    stillBlocked.status === 428 || stillBlocked.status === 403, `got ${stillBlocked.status}`);
  check('gate names the reason', stillBlocked.body?.code === 'PASSWORD_CHANGE_REQUIRED',
    String(stillBlocked.body?.code));

  const change = await api('POST', '/api/auth/change-password', {
    token: gatedLogin.body.token,
    body: { currentPassword: 'TempPass#2026', newPassword: 'FlowFinal#2026' },
  });
  check('password changed', change.status === 200, `got ${change.status}`);

  const afterChange = await api('POST', '/api/auth/login', {
    body: { email: EMAIL, password: 'FlowFinal#2026' },
  });
  check('rider logs in after changing it', !!afterChange.body?.token);
  check('gate cleared after the change', afterChange.body?.user?.mustChangePassword !== true);

  // ---------- 3. Fare metrics ----------
  console.log('\n3. FARE METRICS');
  const pricingBefore = await api('GET', '/api/pricing/config');
  check('public pricing readable', pricingBefore.status === 200);
  const orig = pricingBefore.body;

  const pricingWrite = await api('PUT', '/api/admin/pricing', {
    token: adminTok,
    body: { baseFare: 700, perKmRate: 150, minimumFare: 1200 },
  });
  check('admin writes pricing', pricingWrite.status === 200, `got ${pricingWrite.status}`);

  const pricingAfter = await api('GET', '/api/pricing/config');
  const applied = pricingAfter.body?.pricing || pricingAfter.body;
  check('new pricing applied',
    Number(applied.baseFare) === 700 && Number(applied.perKmRate) === 150,
    JSON.stringify(applied).slice(0, 80));

  const origPricing = pricingBefore.body?.pricing || pricingBefore.body;
  const restore = await api('PUT', '/api/admin/pricing', {
    token: adminTok,
    body: {
      baseFare: origPricing.baseFare, perKmRate: origPricing.perKmRate,
      minimumFare: origPricing.minimumFare, perKgRate: origPricing.perKgRate,
    },
  });
  check('pricing restored', restore.status === 200);
  const restored = (await api('GET', '/api/pricing/config')).body;
  check('pricing back to original',
    Number((restored.pricing || restored).baseFare) === Number(origPricing.baseFare),
    JSON.stringify(restored.pricing || restored));

  const unauthPricing = await api('PUT', '/api/admin/pricing', {
    body: { baseFare: 1 },
  });
  check('pricing write blocked without token', unauthPricing.status === 401, `got ${unauthPricing.status}`);

  // ---------- helpers for orders ----------
  const PICKUP = { address: 'Flow Test Pickup, 12 Aggrey Road', plusCode: '6FP9R28X+6W' };
  const DROPOFF = { address: 'Flow Test Dropoff, 45 King George V Road', plusCode: '6FR5CFP2+HG' };

  // Decoded from the Plus Codes by hand so the payload is deterministic:
  //   6FP9R28X+6W -> 6.45000, 3.39000   (Lagos Island)
  //   6FR5CFP2+HG -> 6.52400, 3.37900   (Lagos mainland)
  const PICKUP_COORDS = { lat: 6.45, lng: 3.39 };
  const DROPOFF_COORDS = { lat: 6.524, lng: 3.379 };

  let orderSeq = 0;

  async function placeOrder(overrides = {}) {
    orderSeq++;
    const n = orderSeq;
    return api('POST', '/api/orders', {
      body: {
        pickupType: 'immediate',
        pickupAddress: PICKUP.address,
        pickupLat: PICKUP_COORDS.lat,
        pickupLng: PICKUP_COORDS.lng,
        pickupPlusCode: PICKUP.plusCode,
        dropoffAddress: DROPOFF.address,
        dropoffLat: DROPOFF_COORDS.lat,
        dropoffLng: DROPOFF_COORDS.lng,
        dropoffPlusCode: DROPOFF.plusCode,
        senderName: 'Flow Sender',
        senderPhone: '+2348012345678',
        recipientName: 'Flow Recipient',
        recipientPhone: '+2348098765432',
        paymentMethod: 'cod',
        description: `Flow test parcel ${n}`,
        ...overrides,
      },
    });
  }

  async function assign(orderId, riderId) {
    const target = { id: riderId };
    return api('POST', `/api/admin/order/${orderId}/assign`, {
      token: adminTok,
      body: { riderId: target.id },
    });
  }

  /**
   * Mutations answer { success: true } rather than echoing the row, so the
   * authoritative state has to be read back from the admin detail endpoint.
   */
  async function fetchOrder(orderId) {
    const r = await api('GET', `/api/admin/orders/${orderId}`, { token: adminTok });
    return r.body?.order || r.body || {};
  }

  const riders = await api('GET', '/api/admin/riders', { token: adminTok });
  const riderList = Array.isArray(riders.body) ? riders.body : (riders.body.riders || riders.body.accounts || []);
  check('admin can list riders', riderList.length > 0, `${riderList.length} riders`);
  // Pick the rider whose token we actually hold, by matching the email we
  // logged in with. Taking the first row silently assigns to the wrong rider.
  const me = riderList.find((r) => r.email === 'rider2@nizelogistics.com');
  const riderId = me?.id || riderList.find((r) => r.role === 'rider')?.id || riderList[0]?.id;

  // ---------- 4. Immediate happy path ----------
  console.log('\n4. IMMEDIATE ORDER — HAPPY PATH');
  const o1 = await placeOrder();
  check('order created', o1.status === 201 || o1.status === 200, `got ${o1.status}`);
  const order1 = o1.body.order || o1.body;
  check('ticket id assigned', !!order1.ticketId, order1.ticketId);
  check('starts pending', order1.status === 'pending', order1.status);
  check('priced from routing', Number(order1.totalPrice) > 0, `${order1.totalPrice} NGN`);
  const full1 = await fetchOrder(order1.id);
  check('order persisted with distance', Number(full1.distanceKm) > 0, `${full1.distanceKm} km`);
  check('scheduled order keeps its type', full1.pickupType === 'immediate', full1.pickupType);

  const a1 = await assign(order1.id, riderId);
  check('admin assigns rider', a1.status === 200, `got ${a1.status}`);
  check('now assigned', (await fetchOrder(order1.id)).status === 'assigned');

  const accept1 = await api('POST', `/api/rider/accept/${order1.id}`, { token: riderTok });
  check('rider accepts', accept1.status === 200, `got ${accept1.status}`);
  check('now accepted', (await fetchOrder(order1.id)).status === 'accepted');

  const pickup1 = await api('POST', `/api/rider/pickup/${order1.id}`, {
    token: riderTok, body: { notes: 'Collected from the gate' },
  });
  check('rider picks up', pickup1.status === 200, `got ${pickup1.status}`);
  check('now picked_up', (await fetchOrder(order1.id)).status === 'picked_up');

  const transit1 = await api('POST', `/api/rider/in-transit/${order1.id}`, { token: riderTok });
  check('rider in transit', transit1.status === 200);
  check('now in_transit', (await fetchOrder(order1.id)).status === 'in_transit');

  const deliver1 = await api('POST', `/api/rider/deliver/${order1.id}`, {
    token: riderTok, body: { cashCollected: true, notes: 'Delivered to recipient' },
  });
  check('rider delivers', deliver1.status === 200, `got ${deliver1.status}`);
  const delivered1 = await fetchOrder(order1.id);
  check('now delivered', delivered1.status === 'delivered', delivered1.status);
  check('cash collection recorded', delivered1.cashCollected === true, String(delivered1.cashCollected));
  check('delivery notes stored', !!delivered1.deliveryNotes, String(delivered1.deliveryNotes));

  // ---------- 5. Scheduled order ----------
  console.log('\n5. SCHEDULED ORDER');
  // The schema rejects a scheduled time in the past, so aim a day out.
  const when = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const o2 = await placeOrder({
    pickupType: 'scheduled',
    scheduledPickupAt: when,
    itemDescription: 'Scheduled parcel',
  });
  const order2 = o2.body.order || o2.body;
  check('scheduled order created', o2.status === 201 || o2.status === 200, `got ${o2.status}`);
  const full2 = await fetchOrder(order2.id);
  check('scheduled type stored', full2.pickupType === 'scheduled', full2.pickupType);
  check('scheduledFor stored', !!full2.scheduledPickupAt, String(full2.scheduledPickupAt));
  check('still pending', full2.status === 'pending');

  // ---------- 6. Rider rejection ----------
  console.log('\n6. RIDER REJECTION');
  const a2 = await assign(order2.id, riderId);
  check('second order assigned', a2.status === 200, `got ${a2.status}`);
  check('declinedCount starts at 0', Number((await fetchOrder(order2.id)).declinedCount || 0) === 0);

  const decline = await api('POST', `/api/rider/decline/${order2.id}`, { token: riderTok });
  check('rider declines', decline.status === 200, `got ${decline.status}`);
  const declined = await fetchOrder(order2.id);
  check('returned to pending', declined.status === 'pending', declined.status);
  check('rider unassigned on decline', !declined.assignedRiderId, String(declined.assignedRiderId));
  check('declinedCount incremented', Number(declined.declinedCount) === 1, String(declined.declinedCount));

  // Once declined the order is unassigned, so this rider no longer owns it —
  // which surfaces as 403 rather than the 409 you would get while still holding it.
  const declineAgain = await api('POST', `/api/rider/decline/${order2.id}`, { token: riderTok });
  check('cannot decline an unassigned order', declineAgain.status === 403, `got ${declineAgain.status}`);

  // reassign and let it complete later in the concurrency block
  const reassign = await assign(order2.id, riderId);
  check('reassigned after decline', reassign.status === 200, `got ${reassign.status}`);

  // ---------- 7. Illegal transition ----------
  console.log('\n7. ILLEGAL TRANSITION GUARD');
  const o3 = await placeOrder({ itemDescription: 'Illegal jump test' });
  const order3 = o3.body.order || o3.body;
  const a3 = await assign(order3.id, riderId);
  const acc3 = await api('POST', `/api/rider/accept/${order3.id}`, { token: riderTok });

  const skipPickup = await api('POST', `/api/rider/in-transit/${order3.id}`, { token: riderTok });
  check('cannot skip pickup', skipPickup.status === 409, `got ${skipPickup.status}`);

  const skipAll = await api('POST', `/api/rider/deliver/${order3.id}`, { token: riderTok });
  check('cannot deliver without pickup', skipAll.status === 409, `got ${skipAll.status}`);

  // Re-login: the token issued before the forced password change is stale.
  const wrongRiderTok = await login(EMAIL, 'FlowFinal#2026');
  const wrongRider = await api('POST', `/api/rider/pickup/${order3.id}`, { token: wrongRiderTok });
  check('another rider cannot touch this order', wrongRider.status === 403, `got ${wrongRider.status}`);

  // ---------- 8. Cancellation ----------
  console.log('\n8. CANCELLATION');
  const cancel = await api('POST', `/api/admin/order/${order3.id}/cancel`, {
    token: adminTok, body: { reason: 'Sender changed their mind' },
  });
  check('order cancelled', cancel.status === 200, `got ${cancel.status}`);
  const cancelledRow = await fetchOrder(order3.id);
  check('now cancelled', cancelledRow.status === 'cancelled', cancelledRow.status);
  check('cancellation reason stored', !!cancelledRow.cancellationReason, String(cancelledRow.cancellationReason));

  const cancelAgain = await api('POST', `/api/admin/order/${order3.id}/cancel`, {
    token: adminTok, body: { reason: 'again' },
  });
  check('cannot cancel a cancelled order', cancelAgain.status === 409, `got ${cancelAgain.status}`);

  const deliverCancelled = await api('POST', `/api/rider/deliver/${order3.id}`, { token: riderTok });
  check('cannot deliver a cancelled order', deliverCancelled.status === 409, `got ${deliverCancelled.status}`);

  // ---------- 9. Tracking ----------
  console.log('\n9. CUSTOMER TRACKING');
  const track = await api('GET', `/api/tracking/${order1.ticketId}`);
  const tracked = track.body?.order || {};
  check('tracking by ticket', track.status === 200, `got ${track.status}`);
  check('tracking shows delivered', tracked.status === 'delivered', tracked.status);
  check('tracking returns codes', !!tracked.pickupPlusCode && !!tracked.dropoffPlusCode);
  check('tracking returns route geometry', !!track.body?.route?.geometry?.coordinates,
    track.body?.route?.source || '');
  check('tracking gives a human distance', !!track.body?.route?.distanceText,
    track.body?.route?.distanceText || '');
  check('tracking shows rider name', !!track.body?.rider?.fullName, track.body?.rider?.fullName || 'none');
  check('tracking masks the rider phone', !/[0-9]{6,}/.test(track.body?.rider?.phone || ''),
    String(track.body?.rider?.phone || ''));

  const badTrack = await api('GET', '/api/tracking/NIZ-DOESNOTEXIST');
  check('unknown ticket rejected', badTrack.status === 400 || badTrack.status === 404,
    `got ${badTrack.status}`);
  const badFormat = await api('GET', '/api/tracking/not-a-ticket');
  check('malformed ticket rejected', badFormat.status === 400, `got ${badFormat.status}`);

  // ---------- 10. Rider history / earnings ----------
  console.log('\n10. RIDER EARNINGS');
  const hist = await api('GET', '/api/rider/history', { token: riderTok });
  check('rider history', hist.status === 200);
  const deliveredCount = (hist.body.deliveries || hist.body.orders || []).filter
    ? (hist.body.deliveries || hist.body.orders || []).filter((o) => o.status === 'delivered').length
    : 0;
  check('history includes the delivered order', deliveredCount >= 1, `${deliveredCount} delivered`);
  check('earnings present', hist.body?.summary?.earnings !== undefined,
    JSON.stringify(hist.body?.summary || {}).slice(0, 80));

  const dash = await api('GET', '/api/rider/dashboard', { token: riderTok });
  check('rider dashboard', dash.status === 200);

  // ---------- 11. Concurrency ----------
  console.log('\n11. MULTIPLE ORDERS IN FLIGHT');
  const concurrent = [];
  for (let i = 0; i < 3; i++) {
    concurrent.push(placeOrder({ itemDescription: `Concurrent parcel ${i + 1}` }));
  }
  const created = await Promise.all(concurrent);
  check('three orders created', created.every((r) => r.status === 201 || r.status === 200));

  const assignedAll = await Promise.all(
    created.map((r) => assign((r.body.order || r.body).id, riderId)),
  );
  check('all three assigned', assignedAll.every((r) => r.status === 200));

  const acceptedAll = await Promise.all(
    created.map((r) => api('POST', `/api/rider/accept/${(r.body.order || r.body).id}`, { token: riderTok })),
  );
  check('all three accepted', acceptedAll.every((r) => r.status === 200));

  const statuses = created.map((r, i) => (acceptedAll[i].body.order || acceptedAll[i].body).status);
  check('no cross-talk — all accepted', statuses.every((s) => s === 'accepted'), statuses.join(','));

  // finish the first two, leave the third in transit
  const live = created.map((r) => (r.body.order || r.body).id);
  for (const id of live.slice(0, 2)) {
    await api('POST', `/api/rider/pickup/${id}`, { token: riderTok });
    await api('POST', `/api/rider/in-transit/${id}`, { token: riderTok });
    await api('POST', `/api/rider/deliver/${id}`, { token: riderTok, body: { cashCollected: true } });
  }
  await api('POST', `/api/rider/pickup/${live[2]}`, { token: riderTok });
  await api('POST', `/api/rider/in-transit/${live[2]}`, { token: riderTok });

  const final = await Promise.all(
    live.map((id) => api('GET', `/api/orders/${id}`, { token: adminTok })),
  );
  const finalStatuses = [];
  for (const id of live) {
    finalStatuses.push((await fetchOrder(id)).status);
  }
  check('two delivered, one in transit',
    finalStatuses[0] === 'delivered' && finalStatuses[1] === 'delivered' && finalStatuses[2] === 'in_transit',
    finalStatuses.join(','));

  // ---------- live rerouting: rider's live GPS -> drop-off ----------
  console.log('\nLIVE RE ROUTING');
  const inTransitOrder = (created[2].body.order || created[2].body);
  const loc = await api('POST', '/api/location/update', {
    token: riderTok,
    body: { lat: 4.82, lng: 7.05, orderId: inTransitOrder.id },
  });
  check('rider location recorded', loc.status === 200, `got ${loc.status}`);
  const liveTrack = await api('GET', `/api/tracking/${inTransitOrder.ticketId}`);
  check('in-transit tracking returns a live route',
    !!liveTrack.body?.liveRoute?.geometry?.coordinates,
    liveTrack.body?.liveRoute?.source || 'no liveRoute');
  check('live route gives remaining distance',
    !!liveTrack.body?.liveRoute?.distanceText,
    liveTrack.body?.liveRoute?.distanceText || '');
  // A delivered order must not leak a live route.
  const deliveredTrack = await api('GET', `/api/tracking/${order1.ticketId}`);
  check('delivered order has no live route',
    deliveredTrack.body?.liveRoute === undefined || deliveredTrack.body?.liveRoute === null,
    'leaked a liveRoute');

  // ---------- 12. Audit ----------
  console.log('\n12. AUDIT TRAIL');
  const audit = await api('GET', '/api/admin/audit', { token: adminTok });
  check('audit readable', audit.status === 200);
  const entries = audit.body.logs || [];
  check('audit captured activity', Array.isArray(entries) && entries.length > 5,
    Array.isArray(entries) ? `${entries.length} entries` : 'unshaped');
  const actions = new Set(entries.map((e) => e.action || e.eventType));
  check('audit recorded the status changes', actions.size > 1, [...actions].slice(0, 6).join(','));

  // ---------- 13. RBAC ----------
  console.log('\n13. ROLE BOUNDARIES');
  const riderCreates = await api('POST', '/api/admin/invite', {
    token: riderTok, body: { email: `x${Date.now()}@x.com`, role: 'rider' },
  });
  check('rider cannot invite', riderCreates.status === 403, `got ${riderCreates.status}`);

  const riderAdmin = await api('GET', '/api/admin/audit', { token: riderTok });
  check('rider cannot read audit', riderAdmin.status === 403, `got ${riderAdmin.status}`);

  const riderOrders = await api('GET', '/api/admin/orders', { token: riderTok });
  check('rider cannot list all orders', riderOrders.status === 403, `got ${riderOrders.status}`);

  const riderInviteAdmin = await api('POST', '/api/admin/invite', {
    token: adminTok, body: { email: `admin${Date.now()}@x.com`, role: 'admin' },
  });
  check('only super admin invites admins', riderInviteAdmin.status === 403, `got ${riderInviteAdmin.status}`);

  // ---------- summary ----------
  console.log(`\n${'='.repeat(52)}`);
  console.log(`PASSED: ${passed}   FAILED: ${failures.length}`);
  if (failures.length) {
    console.log('\nFAILURES:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(52));
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error('\nHARNESS ERROR:', err.message);
  console.error(err.stack);
  process.exit(2);
});
