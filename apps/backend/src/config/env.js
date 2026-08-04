import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: resolve(__dirname, '../../.env') });

console.log('✅ Environment variables loaded');
console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
