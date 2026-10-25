#!/usr/bin/env node
/**
 * Migration runner.
 *
 * Applies every .sql file in ../migrations in filename order and records what
 * has run in a `schema_migrations` table, so re-running is a no-op. Each file is
 * additionally written to be idempotent on its own.
 *
 *   npm run migrate
 */
import '../src/config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Add it to apps/backend/.env');
    process.exit(1);
  }

  const client = clientFromUrl(process.env.DATABASE_URL);
  await client.connect();
  console.log('✅ Connected to the database\n');

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
  const done = new Set(applied.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;

  for (const file of files) {
    if (done.has(file)) {
      console.log(`⏭  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`▶  ${file} ... `);

    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log('done');
      ran++;
    } catch (error) {
      console.log('FAILED');
      console.error(`\n❌ ${file}: ${error.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\n✅ Migrations complete (${ran} applied, ${files.length - ran} already up to date)`);
  await client.end();
}

main().catch((error) => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});
