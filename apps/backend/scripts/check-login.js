/**
 * Compares a candidate password against the stored hash for a real account.
 *
 * Answers "is the password wrong, or is the lookup wrong?" from the database
 * itself rather than from the HTTP response, which deliberately does not say.
 *
 *   node scripts/check-login.js <email> <candidate-password>
 */
import '../src/config/env.js';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

async function main() {
  const [identifier, candidate] = process.argv.slice(2);
  if (!identifier || !candidate) {
    console.error('usage: node scripts/check-login.js <email> <password>');
    process.exit(1);
  }

  const url = new URL(process.env.DATABASE_URL);
  const client = new Client({
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, email, username, role, status, password_hash
       FROM users
      WHERE lower(email) = lower($1) OR lower(username) = lower($1)
      LIMIT 1`,
    [identifier]
  );

  if (rows.length === 0) {
    console.log('RESULT: no account matched that identifier');
    await client.end();
    return;
  }

  const u = rows[0];
  console.log(`account   : ${u.email}`);
  console.log(`username  : ${u.username}`);
  console.log(`role      : ${u.role}`);
  console.log(`status    : ${u.status}`);
  console.log(`hash algo : ${u.password_hash.slice(0, 7)}`);

  const ok = await bcrypt.compare(candidate, u.password_hash);
  console.log(`\nPASSWORD  : ${ok ? 'MATCHES' : 'does NOT match'}`);

  await client.end();
}

main().catch((e) => {
  console.error('check-login failed:', e.message);
  process.exit(1);
});
