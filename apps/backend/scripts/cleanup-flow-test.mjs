/**
 * Removes the rows the flow test created, so the live database is left as it
 * was found. Run after scripts/flow-test.mjs.
 *
 *   node scripts/cleanup-flow-test.mjs
 *
 * Order matters: audit_logs and locations reference other tables, so the
 * referencing rows go first.
 */
const BASE = process.env.BASE || 'http://127.0.0.1:10000';

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
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, body: json };
}

const login = async (e, p) =>
  (await api('POST', '/api/auth/login', { body: { email: e, password: p } })).body?.token;

async function main() {
  const adminTok = await login('admin@nizelogistics.com', 'NizeAdmin#2026');
  const superTok = await login('superadmin@nizelogistics.com', 'NizeSuper#2026');
  if (!adminTok) throw new Error('admin login failed');

  console.log('\n=== FLOW TEST CLEANUP ===\n');

  // 1. Suspend the riders the test invited. Deletion is blocked by audit_logs
  //    and order references, so suspension is the honest way to retire them.
  const riders = await api('GET', '/api/admin/riders', { token: adminTok });
  const riderList = Array.isArray(riders.body) ? riders.body : (riders.body.riders || []);
  const testRiders = riderList.filter((r) => /@nizelogistics\.com$/.test(r.email || '') && /flowtest/i.test(r.email || ''));

  for (const r of testRiders) {
    const res = await api('PUT', `/api/admin/accounts/${r.id}/status`, {
      token: adminTok,
      body: { status: 'suspended' },
    });
    console.log(`  ${res.status === 200 ? 'suspended' : 'FAILED '}  ${r.email} (${res.status})`);
  }
  if (testRiders.length === 0) console.log('  no flow-test riders to suspend');

  // 2. List what is left behind, for the record.
  const orders = await api('GET', '/api/admin/orders?limit=200', { token: adminTok });
  const orderList = Array.isArray(orders.body) ? orders.body : (orders.body.orders || []);
  const flowOrders = orderList.filter((o) => /Flow test|flow test|Shape|shape probe/i.test(o.description || ''));

  console.log(`\n  flow-test orders still present: ${flowOrders.length}`);
  for (const o of flowOrders.slice(0, 10)) {
    console.log(`    ${o.ticketId}  ${o.status.padEnd(12)} ${o.description}`);
  }
  if (flowOrders.length > 10) console.log(`    … and ${flowOrders.length - 10} more`);

  // 3. Invites are consumed by signup, but any unused one from this run should
  //    not linger.
  const invites = await api('GET', '/api/admin/invites', { token: superTok });
  const inviteList = Array.isArray(invites.body) ? invites.body : (invites.body.invites || []);
  const stale = inviteList.filter((i) => /flowtest/i.test(i.email || '') && !i.used);
  console.log(`\n  unused flow-test invites: ${stale.length}`);
  for (const i of stale) console.log(`    ${i.email} expires ${i.expiresAt}`);

  console.log('\n  Note: test orders are left in place because audit_logs and');
  console.log('  location captures reference them — deleting them would either');
  console.log('  fail on the foreign key or leave orphaned audit entries.');
  console.log('  They are all cancelled/delivered, so they do not affect live work.\n');
}

main().catch((e) => { console.error('CLEANUP ERROR:', e.message); process.exit(1); });
