/**
 * Dumps the exact response shapes for the endpoints the flow test asserts on,
 * so the harness matches reality instead of a guessed shape.
 */
const BASE = 'http://127.0.0.1:10000';

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 150) }; }
  return { status: res.status, body: json };
}
const login = async (e, p) => (await api('POST', '/api/auth/login', { body: { email: e, password: p } })).body?.token;
const keys = (o) => (o && typeof o === 'object' ? Object.keys(o) : typeof o);

const adminTok = await login('admin@nizelogistics.com', 'NizeAdmin#2026');
const riderTok = await login('rider2@nizelogistics.com', 'SarahRides#2026');

console.log('\n--- ORDER CREATE ---');
const o = await api('POST', '/api/orders', { body: {
  pickupType: 'immediate', pickupAddress: 'Shape A', pickupLat: 6.45, pickupLng: 3.39,
  pickupPlusCode: '6FP9R28X+6W', dropoffAddress: 'Shape B', dropoffLat: 6.524, dropoffLng: 3.379,
  dropoffPlusCode: '6FR5CFP2+HG', senderName: 'Shape Sender', senderPhone: '+2348012345678',
  recipientName: 'Shape Recipient', recipientPhone: '+2348098765432', paymentMethod: 'cod',
  description: 'shape probe 2',
} });
console.log('status', o.status, 'top:', keys(o.body));
const ord = o.body?.order || o.body;
console.log('order keys:', keys(ord));
console.log('has routeGeometry?', !!ord.routeGeometry, '| route?', keys(ord.route));
console.log('scheduledFor?', ord.scheduledFor, '| pickupType:', ord.pickupType);

console.log('\n--- ASSIGN ---');
const riders = await api('GET', '/api/admin/riders', { token: adminTok });
const rl = Array.isArray(riders.body) ? riders.body : (riders.body.riders || []);
const rid = (rl.find((r) => r.email === 'rider2@nizelogistics.com') || rl[0]).id;
const a = await api('POST', `/api/admin/order/${ord.id}/assign`, { token: adminTok, body: { riderId: rid } });
console.log('status', a.status, 'top:', keys(a.body), 'order keys:', keys(a.body?.order || a.body));
console.log('assigned order status:', (a.body?.order || a.body)?.status);

console.log('\n--- DECLINE (after reassign) ---');
await api('POST', `/api/admin/order/${ord.id}/assign`, { token: adminTok, body: { riderId: rid } });
const d = await api('POST', `/api/rider/decline/${ord.id}`, { token: riderTok });
console.log('status', d.status, 'top:', keys(d.body), 'order keys:', keys(d.body?.order || d.body));
console.log('declined order status:', (d.body?.order || d.body)?.status, 'declinedCount:', (d.body?.order || d.body)?.declinedCount);

console.log('\n--- CANCEL ---');
await api('POST', `/api/admin/order/${ord.id}/assign`, { token: adminTok, body: { riderId: rid } });
const c = await api('POST', `/api/admin/order/${ord.id}/cancel`, { token: adminTok, body: { reason: 'shape probe' } });
console.log('status', c.status, 'top:', keys(c.body), 'order keys:', keys(c.body?.order || c.body));
console.log('cancelled order status:', (c.body?.order || c.body)?.status);

console.log('\n--- TRACKING (delivered order) ---');
const hist = await api('GET', '/api/rider/history', { token: riderTok });
const done = hist.body.orders.find((x) => x.status === 'delivered');
if (done) {
  const t = await api('GET', `/api/tracking/${done.ticketId}`);
  console.log('status', t.status, 'top:', keys(t.body));
  console.log('order keys:', keys(t.body.order), '| rider keys:', keys(t.body.rider));
  console.log('order.statusLabel:', t.body.order?.statusLabel, '| route keys:', keys(t.body.route));
}

console.log('\n--- PRICING WRITE SHAPE ---');
const p = await api('PUT', '/api/admin/pricing', { token: adminTok, body: { baseFare: 700, perKmRate: 150, minimumFare: 1200, perKgRate: 50 } });
console.log('status', p.status, 'top:', keys(p.body), 'pricing:', JSON.stringify(p.body?.pricing));
await api('PUT', '/api/admin/pricing', { token: adminTok, body: { baseFare: 500, perKmRate: 120, minimumFare: 1000, perKgRate: 50 } });

console.log('\n--- UNKNOWN TICKET ---');
for (const t of ['NIZ-DOESNOTEXIST', 'GARBAGE', 'NIZ-43RTG1']) {
  const r = await api('GET', `/api/tracking/${t}`);
  console.log(` ${t} -> ${r.status}`);
}
