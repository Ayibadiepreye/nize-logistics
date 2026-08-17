import 'dotenv/config';
import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting to seed users...');

    // Users to create
    const users = [
      {
        email: 'superadmin@nizelogistics.com',
        password: 'NizeSuper#2026',
        role: 'super_admin',
        name: 'Super Admin',
        phone: '+2347063980120'
      },
      {
        email: 'admin@nizelogistics.com',
        password: 'NizeAdmin#2026',
        role: 'admin',
        name: 'Admin User',
        phone: '+2348076690182'
      },
      {
        email: 'rider@nizelogistics.com',
        password: 'NizeRider#2026',
        role: 'rider',
        name: 'Rider User',
        phone: '+2347000000000'
      }
    ];

    for (const user of users) {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`⚠️  User ${user.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Insert user
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, phone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
         RETURNING id, email, role`,
        [user.email.split('@')[0], user.email, hashedPassword, user.role, user.name, user.phone]
      );

      console.log(`✅ Created ${user.role}: ${user.email} (ID: ${result.rows[0].id})`);
    }

    console.log('🎉 User seeding completed!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SUPER ADMIN');
    console.log('  Email:    superadmin@nizelogistics.com');
    console.log('  Password: NizeSuper#2026');
    console.log('');
    console.log('ADMIN');
    console.log('  Email:    admin@nizelogistics.com');
    console.log('  Password: NizeAdmin#2026');
    console.log('');
    console.log('RIDER');
    console.log('  Email:    rider@nizelogistics.com');
    console.log('  Password: NizeRider#2026');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed users:', error);
    process.exit(1);
  });
