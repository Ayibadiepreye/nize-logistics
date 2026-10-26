/**
 * Reports the real state of the schema, so a failed migration can be diagnosed
 * from evidence rather than guesswork.
 *
 *   node scripts/inspect-db.js
 */
import '../src/config/env.js';
import pg from 'pg';

const { Client } = pg;

async function main() {
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

  const q = async (label, sql) => {
    try {
      const { rows } = await client.query(sql);
      console.log(`\n=== ${label} ===`);
      console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
      console.log(`\n=== ${label} === ERROR: ${e.message}`);
    }
  };

  await q('migrations recorded', 'SELECT filename, applied_at FROM schema_migrations ORDER BY filename');

  await q(
    'orders columns added by 002',
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'orders'
       AND column_name IN ('pickup_label','pickup_plus_code','dropoff_label','dropoff_plus_code')
     ORDER BY column_name`
  );

  await q(
    'locations table exists?',
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'locations'`
  );

  await q(
    'orders columns required by auth.js',
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name IN ('must_change_password','password_changed_at','last_login_at')
     ORDER BY column_name`
  );

  await q(
    'extensions',
    `SELECT extname FROM pg_extension ORDER BY extname`
  );

  await q(
    'locations columns',
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'locations' ORDER BY ordinal_position`
  );

  await client.end();
}

main().catch((e) => {
  console.error('inspect failed:', e.message);
  process.exit(1);
});
