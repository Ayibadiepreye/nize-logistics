/**
 * Remove the unused flow-test invites left behind by earlier failed runs.
 *
 * There is no DELETE /admin/invites endpoint (invites are meant to be
 * single-use and to expire on their own), so this goes straight at the table.
 * Only rows matching the flow-test marker are touched.
 *
 *   node scripts/prune-flowtest-invites.mjs
 */
import '../src/config/env.js';
import pg from 'pg';

const { Client } = pg;
const TAG = 'prune-flowtest-invites';

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

  try {
    const { rows } = await client.query(
      `SELECT email, used, expires_at FROM invites
        WHERE email LIKE 'flowtest%@nizelogistics.com'
        ORDER BY created_at`,
    );

    console.log(`\n  unused flow-test invites: ${rows.length}`);
    for (const r of rows) {
      console.log(`    ${r.email}  used=${r.used}  expires=${r.expires_at}`);
    }

    const del = await client.query(
      `DELETE FROM invites WHERE email LIKE 'flowtest%@nizelogistics.com' RETURNING email`,
    );
    console.log(`\n  deleted ${del.rowCount} invite row(s).`);

    const remaining = await client.query(
      `SELECT count(*)::int AS n FROM invites WHERE email LIKE 'flowtest%'`,
    );
    console.log(`  remaining flowtest invites: ${remaining.rows[0].n}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${TAG}] failed:`, err.message);
  process.exitCode = 1;
});
