import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';

// Parse connection string
const connectionString = process.env.DATABASE_URL;
console.log('🔍 DATABASE_URL exists:', !!connectionString);
console.log('🔍 DATABASE_URL length:', connectionString?.length || 0);

const requireSSL = connectionString?.includes('sslmode=require');

// Parse the DATABASE_URL manually to avoid pg parsing issues
let poolConfig;
if (connectionString) {
  try {
    const url = new URL(connectionString);
    poolConfig = {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.split('/')[1],
      ssl: requireSSL ? {
        rejectUnauthorized: false
      } : false
    };
    console.log('🔍 DB Config:', {
      user: poolConfig.user,
      host: poolConfig.host,
      database: poolConfig.database,
      passwordLength: poolConfig.password?.length || 0,
      passwordType: typeof poolConfig.password
    });
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error.message);
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: requireSSL ? {
        rejectUnauthorized: false
      } : false
    };
  }
} else {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: requireSSL ? {
      rejectUnauthorized: false
    } : false
  };
}

const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });

export async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected to Neon');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error; // Don't exit process, let caller handle it
  }
}
