import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

/**
 * Database connection.
 *
 * SSL is ON by default and only turns off when the URL explicitly asks for
 * plaintext (`sslmode=disable`). This used to be the reverse — SSL was only
 * enabled when the URL contained `sslmode=require` — which meant a connection
 * string without that parameter connected in plaintext. Neon terminates TLS at
 * its proxy and refuses plaintext, so such a connection is rejected outright.
 * Neon URLs do not carry `sslmode=require`, so this path has to default to on.
 */

const connectionString = process.env.DATABASE_URL;
console.log('🔍 DATABASE_URL exists:', !!connectionString);

/** True only when the caller has explicitly asked for an unencrypted connection. */
function sslExplicitlyDisabled(url) {
  if (!url) return false;
  const params = new URLSearchParams(url.search);
  const mode = (params.get('sslmode') || '').toLowerCase();
  if (mode === 'disable' || mode === 'prefer' || mode === 'allow') return true;
  return false;
}

function buildPoolConfig() {
  const ssl = { rejectUnauthorized: false };

  if (!connectionString) {
    return { connectionString: null, ssl: false };
  }

  try {
    const url = new URL(connectionString);
    const config = {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: parseInt(url.port, 10) || 5432,
      // Strip any query string that may be attached to the path.
      database: url.pathname.replace(/^\//, '').split('?')[0],
      ssl: sslExplicitlyDisabled(url) ? false : ssl,
    };
    console.log('🔍 DB Config:', {
      host: config.host,
      port: config.port,
      database: config.database,
      ssl: !!config.ssl,
    });
    return config;
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error.message);
    return {
      connectionString,
      ssl: connectionString.includes('sslmode=disable') ? false : ssl,
    };
  }
}

const pool = new Pool(buildPoolConfig());

// Surface idle-client errors instead of letting them become unhandled rejections.
pool.on('error', (error) => {
  console.error('❌ Unexpected database pool error:', error.message);
});

export const db = drizzle(pool, { schema });

export async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error; // Don't exit the process, let the caller handle it
  }
}
