/**
 * Prints every route the API actually exposes, read straight off the Express
 * router stacks rather than transcribed by hand.
 *
 * Written because the flow chart's endpoint list had drifted from reality
 * (wrong verbs and paths). Anything that documents the API should be
 * regenerable from this instead of retyped.
 *
 *   node scripts/list-routes.mjs
 */
import '../src/config/env.js';

import authRouter from '../src/routes/auth.js';
import ordersRouter from '../src/routes/orders.js';
import trackingRouter from '../src/routes/tracking.js';
import riderRouter from '../src/routes/rider.js';
import adminRouter from '../src/routes/admin.js';
import superAdminRouter from '../src/routes/superAdmin.js';
import recipientRouter from '../src/routes/recipient.js';
import paystackRouter from '../src/routes/paystack.js';
import uploadRouter from '../src/routes/upload.js';
import refundsRouter from '../src/routes/refunds.js';
import pricingRouter from '../src/routes/pricing.js';
import locationRouter from '../src/routes/location.js';
import locationsRouter from '../src/routes/locations.js';

/** Mount prefix -> router, mirroring src/server.js. */
const MOUNTS = [
  ['/api/auth', authRouter],
  ['/api/orders', ordersRouter],
  ['/api/tracking', trackingRouter],
  ['/api/rider', riderRouter],
  ['/api/admin', adminRouter],
  ['/api/super', superAdminRouter],
  ['/api/recipient', recipientRouter],
  ['/api/upload', uploadRouter],
  ['/api/refunds', refundsRouter],
  ['/api/pricing', pricingRouter],
  ['/api/location', locationRouter],
  ['/api/locations', locationsRouter],
  // Mounted before express.json() so the raw body survives for HMAC checks.
  ['/api/paystack/webhook', null],
  ['/api/paystack', paystackRouter],
];

const VERBS = ['get', 'post', 'put', 'patch', 'delete'];

function routesOf(router) {
  const out = [];
  for (const layer of router.stack || []) {
    if (!layer.route) continue; // plain middleware, not a route
    const methods = Object.keys(layer.route.methods || {})
      .filter((m) => VERBS.includes(m))
      .map((m) => m.toUpperCase());
    if (!methods.length) continue;
    out.push({ methods, path: layer.route.path });
  }
  return out;
}

const rows = [];
for (const [prefix, router] of MOUNTS) {
  if (!router) {
    rows.push({ prefix, methods: ['POST'], path: '' });
    continue;
  }
  for (const r of routesOf(router)) {
    const full = (prefix + r.path).replace(/\/+$/, '') || prefix;
    rows.push({ prefix, methods: r.methods, path: full });
  }
}

// De-duplicate (a router can mount the same path for several verbs).
const seen = new Set();
const unique = rows.filter((r) => {
  const key = `${r.methods.join(',')} ${r.path}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

unique.sort((a, b) => a.path.localeCompare(b.path));

console.log(`\n  ${unique.length} routes across ${MOUNTS.length} mounts\n`);
for (const r of unique) {
  console.log(`  ${r.methods.map((m) => m.padEnd(6)).join('|').trimEnd().padEnd(18)} ${r.path}`);
}
