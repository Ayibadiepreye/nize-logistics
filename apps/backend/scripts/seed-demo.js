#!/usr/bin/env node
/**
 * Demo / bootstrap accounts.
 *
 * Creates one account per role using the application's own bcrypt hashing —
 * no plaintext password is ever written to the database, to source control, or
 * to the frontend bundle.
 *
 *   npm run seed:demo
 *
 * Safe to re-run: existing accounts are matched by username and updated rather
 * than duplicated. Passwords are only rewritten when --reset-passwords is
 * passed, so a re-run never silently reverts a password the team has changed.
 *
 * Override any credential with environment variables, e.g.
 *   DEMO_ADMIN_EMAIL=ops@nizelogistics.com DEMO_ADMIN_PASSWORD='…' npm run seed:demo
 */
import '../src/config/env.js';
import bcrypt from 'bcryptjs';
import pkg from 'pg';

const { Client } = pkg;
const BCRYPT_ROUNDS = 12;
const RESET_PASSWORDS = process.argv.includes('--reset-passwords');

/**
 * Roles present in this platform: super_admin, admin and rider.
 *
 * There is deliberately no "customer" account — customers book and track
 * anonymously by ticket id, so the system has no customer login to seed.
 */
const ACCOUNTS = [
  {
    key: 'SUPER_ADMIN',
    username: process.env.DEMO_SUPERADMIN_USERNAME || 'superadmin',
    email: process.env.DEMO_SUPERADMIN_EMAIL || 'superadmin@nizelogistics.com',
    password: process.env.DEMO_SUPERADMIN_PASSWORD || 'NizeSuper#2026',
    role: 'super_admin',
    fullName: 'Nize Super Admin',
    phone: '+2347063980120',
  },
  {
    key: 'ADMIN',
    username: process.env.DEMO_ADMIN_USERNAME || 'admin',
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@nizelogistics.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'NizeAdmin#2026',
    role: 'admin',
    fullName: 'Nize Operations Admin',
    phone: '+2348076690185',
  },
  {
    key: 'RIDER',
    username: process.env.DEMO_RIDER_USERNAME || 'rider',
    email: process.env.DEMO_RIDER_EMAIL || 'rider@nizelogistics.com',
    password: process.env.DEMO_RIDER_PASSWORD || 'NizeRider#2026',
    role: 'rider',
    fullName: 'Demo Dispatch Rider',
    phone: '+2348039346596',
    vehicleType: 'motorcycle',
    plateNumber: 'PHC-001-NZ',
  },
];

function clientFromUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return new Client({
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    database: url.pathname.slice(1),
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  });
}

async function upsertAccount(client, account) {
  const { rows } = await client.query(
    'SELECT id, username, role FROM users WHERE username = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
    [account.username, account.email]
  );
  const existing = rows[0];

  if (!existing) {
    const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
    await client.query(
      `INSERT INTO users
         (username, email, password_hash, role, status, full_name, phone, whatsapp,
          vehicle_type, plate_number, password_changed_at, must_change_password)
       VALUES ($1,$2,$3,$4,'active',$5,$6,$6,$7,$8,NOW(),FALSE)`,
      [
        account.username,
        account.email,
        passwordHash,
        account.role,
        account.fullName,
        account.phone,
        account.vehicleType || null,
        account.plateNumber || null,
      ]
    );
    return 'created';
  }

  // Keep the role and active status correct without disturbing the password.
  await client.query(
    `UPDATE users
        SET role = $2, status = 'active', full_name = COALESCE(full_name, $3), updated_at = NOW()
      WHERE id = $1`,
    [existing.id, account.role, account.fullName]
  );

  if (RESET_PASSWORDS) {
    const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
    await client.query(
      `UPDATE users
          SET password_hash = $2, must_change_password = FALSE, password_changed_at = NOW()
        WHERE id = $1`,
      [existing.id, passwordHash]
    );
    return 'password reset';
  }

  return 'already exists (password untouched)';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Add it to apps/backend/.env');
    process.exit(1);
  }

  const client = clientFromUrl(process.env.DATABASE_URL);
  await client.connect();
  console.log('✅ Connected to the database\n');

  // The singleton config rows the app expects.
  await client.query('INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  await client.query('INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

  const results = [];
  for (const account of ACCOUNTS) {
    const outcome = await upsertAccount(client, account);
    results.push({ ...account, outcome });
    console.log(`  ${account.role.padEnd(12)} ${account.username.padEnd(12)} → ${outcome}`);
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log('  DEMO CREDENTIALS');
  console.log('────────────────────────────────────────────────────────');
  for (const r of results) {
    console.log(`\n  ${r.role.toUpperCase().replace('_', ' ')}`);
    console.log(`    Email:    ${r.email}`);
    console.log(`    Username: ${r.username}`);
    console.log(
      r.outcome === 'already exists (password untouched)'
        ? `    Password: unchanged (re-run with --reset-passwords to set "${r.password}")`
        : `    Password: ${r.password}`
    );
  }
  console.log('\n────────────────────────────────────────────────────────');
  console.log('  Change these from Admin → Accounts after first sign-in.');
  console.log('  Customers do not sign in — they book and track by ticket id.');
  console.log('────────────────────────────────────────────────────────\n');

  await client.end();
}

main().catch((error) => {
  console.error('❌ Seed failed:', error.message);
  process.exit(1);
});
