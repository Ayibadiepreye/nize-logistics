import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Client } = pg;

async function initializeDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('📜 Reading SQL file...');
    const sql = fs.readFileSync(join(__dirname, 'init-db.sql'), 'utf8');

    console.log('🚀 Executing SQL script...');
    await client.query(sql);

    console.log('✅ Database initialized successfully!');
    console.log('\n📊 Tables created:');
    console.log('  - users');
    console.log('  - invites');
    console.log('  - orders');
    console.log('  - reports');
    console.log('  - pricing_config');
    console.log('  - platform_settings');
    console.log('\n🎉 Ready to run the application!');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure your DATABASE_URL is correct in .env file');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed - check your database password');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

initializeDatabase();
