import { db } from './src/lib/db/index.js';
import { users, orders, invites, pricingConfig, platformSettings } from './src/lib/db/schema.js';
import { sql } from 'drizzle-orm';

console.log('🔍 Verifying Nize Logistics Setup...\n');

async function verify() {
  try {
    // Test database connection
    console.log('1️⃣ Testing database connection...');
    
    // Import db connection that already works
    const { testConnection } = await import('./src/lib/db/index.js');
    await testConnection();
    console.log('   ✅ Database connected\n');

    // Check tables exist
    console.log('2️⃣ Checking tables...');
    const tables = ['users', 'invites', 'orders', 'reports', 'pricing_config', 'platform_settings'];
    
    for (const table of tables) {
      const result = await db.execute(sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = ${table}
      )`);
      console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${table}`);
    }
    console.log('');

    // Check enums
    console.log('3️⃣ Checking enums...');
    const enums = ['user_role', 'user_status', 'order_status', 'pickup_type', 'payment_method', 'payment_status'];
    
    for (const enumName of enums) {
      const result = await db.execute(sql`SELECT EXISTS (
        SELECT FROM pg_type WHERE typname = ${enumName}
      )`);
      console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${enumName}`);
    }
    console.log('');

    // Check pricing config
    console.log('4️⃣ Checking default data...');
    const pricing = await db.select().from(pricingConfig);
    if (pricing.length > 0) {
      console.log('   ✅ Pricing config exists');
      console.log(`      Base Fare: ₦${pricing[0].baseFare}`);
      console.log(`      Per KM: ₦${pricing[0].perKmRate}`);
      console.log(`      Minimum: ₦${pricing[0].minimumFare}`);
    } else {
      console.log('   ❌ Pricing config missing');
    }

    const settings = await db.select().from(platformSettings);
    console.log(`   ${settings.length > 0 ? '✅' : '❌'} Platform settings ${settings.length > 0 ? 'exists' : 'missing'}`);
    console.log('');

    // Check user counts
    console.log('5️⃣ Checking data...');
    const userCount = await db.select({ count: sql`count(*)` }).from(users);
    const orderCount = await db.select({ count: sql`count(*)` }).from(orders);
    const inviteCount = await db.select({ count: sql`count(*)` }).from(invites);

    console.log(`   📊 Users: ${userCount[0].count}`);
    console.log(`   📦 Orders: ${orderCount[0].count}`);
    console.log(`   ✉️  Invites: ${inviteCount[0].count}`);
    console.log('');

    // Environment variables check
    console.log('6️⃣ Checking environment variables...');
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'PAYSTACK_SECRET_KEY',
      'PAYSTACK_PUBLIC_KEY',
      'CLOUDINARY_CLOUD_NAME',
      'SMTP_HOST',
      'VAPID_PUBLIC_KEY'
    ];

    let envMissing = 0;
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        console.log(`   ✅ ${envVar}`);
      } else {
        console.log(`   ❌ ${envVar} - MISSING`);
        envMissing++;
      }
    }
    console.log('');

    // Final verdict
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (envMissing === 0 && pricing.length > 0 && settings.length > 0) {
      console.log('🎉 SETUP COMPLETE! Everything looks good!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Start backend: npm run dev');
      console.log('2. Start frontend: cd ../frontend && npm run dev');
      console.log('3. Access platform: http://localhost:3000');
      console.log('');
      console.log('...Plenty Waka! 🚚');
    } else {
      console.log('⚠️  SETUP INCOMPLETE');
      if (envMissing > 0) {
        console.log(`Missing ${envMissing} environment variables`);
      }
      if (pricing.length === 0 || settings.length === 0) {
        console.log('Missing default data - run: node init-database.js');
      }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

verify();
