/**
 * Cross-checks the endpoint list in docs/PLATFORM-FLOW.html against the routes
 * the Express app actually registers.
 *
 * The chart had drifted once (wrong verbs, wrong paths, endpoints that do not
 * exist). This makes that drift a failing check instead of a surprise.
 *
 *   node scripts/verify-chart-endpoints.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

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
  ['/api/paystack', paystackRouter],
];

const VERBS = ['get', 'post', 'put', 'patch', 'delete'];
const real = new Map(); // "METHOD /path" -> true

for (const [prefix, router] of MOUNTS) {
  for (const layer of router.stack || []) {
    if (!layer.route) continue;
    const full = (prefix + layer.route.path).replace(/\/+$/, '') || prefix;
    for (const m of Object.keys(layer.route.methods || {})) {
      if (VERBS.includes(m)) real.set(`${m.toUpperCase()} ${full}`, true);
    }
  }
}
// The webhook is mounted outside express.json() in server.js.
real.set('POST /api/paystack/webhook', true);

// ---- parse the chart ------------------------------------------------------

const html = readFileSync(join(root, 'docs', 'PLATFORM-FLOW.html'), 'utf8');
const documented = new Map();

for (const row of html.match(/<tr><td><span class="m ([A-Z]+)">[^<]*<\/span><\/td><td><code>(\/api\/[^<]+)<\/code><\/td>/g) || []) {
  const m = row.match(/<span class="m ([A-Z]+)">[^<]*<\/span><\/td><td><code>(\/api\/[^<]+)<\/code>/);
  documented.set(`${m[1]} ${m[2]}`, true);
}

// Flow-diagram nodes carry their endpoint in a plain <span>, not a table cell.
for (const m of html.matchAll(/<span>([A-Z]+) (\/api\/[^<]+)<\/span>/g)) {
  documented.set(`${m[1]} ${m[2]}`, true);
}

// ---- compare --------------------------------------------------------------

const missing = [...documented.keys()].filter((k) => !real.has(k));
const undocumented = [...real.keys()].filter((k) => !documented.has(k));

console.log(`\n  real routes:      ${real.size}`);
console.log(`  documented rows:  ${documented.size}`);

if (missing.length) {
  console.log(`\n  IN THE CHART BUT NOT IN THE CODE (${missing.length}):`);
  for (const k of missing.sort()) console.log(`    ${k}`);
}
if (undocumented.length) {
  console.log(`\n  IN THE CODE BUT NOT IN THE CHART (${undocumented.length}):`);
  for (const k of undocumented.sort()) console.log(`    ${k}`);
}
if (!missing.length && !undocumented.length) {
  console.log('\n  OK — the chart and the code agree exactly.');
}

process.exit(missing.length || undocumented.length ? 1 : 0);
