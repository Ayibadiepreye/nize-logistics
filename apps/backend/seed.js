import './src/config/env.js';
import { db } from './src/lib/db/index.js';
import { users, orders } from './src/lib/db/schema.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // 1. Create Admin User
    console.log('👤 Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const [admin] = await db.insert(users).values({
      username: 'admin',
      fullName: 'Admin User',
      email: 'admin@nizelogistics.com',
      phone: '+2347063980120',
      passwordHash: adminPassword,
      role: 'admin',
      status: 'active'
    }).returning().onConflictDoNothing();
    
    if (admin) {
      console.log('✅ Admin created: admin@nizelogistics.com / admin123\n');
    } else {
      console.log('ℹ️  Admin already exists\n');
    }

    // 2. Create Rider Users
    console.log('🏍️  Creating rider users...');
    const riderPassword = await bcrypt.hash('rider123', 10);
    
    const ridersData = [
      {
        username: 'rider1',
        fullName: 'John Rider',
        email: 'rider1@nizelogistics.com',
        phone: '+2348076690182',
        whatsapp: '+2348076690182',
        passwordHash: riderPassword,
        role: 'rider',
        status: 'active',
        vehicleType: 'motorcycle',
        plateNumber: 'ABC-123-XYZ',
        isOnline: true,
        isBusy: false,
        currentLat: '4.8156',
        currentLng: '7.0498',
        totalDeliveries: 45,
        totalAmount: '125000'
      },
      {
        username: 'rider2',
        fullName: 'Sarah Dispatch',
        email: 'rider2@nizelogistics.com',
        phone: '+2349012345678',
        whatsapp: '+2349012345678',
        passwordHash: riderPassword,
        role: 'rider',
        status: 'active',
        vehicleType: 'motorcycle',
        plateNumber: 'DEF-456-XYZ',
        isOnline: true,
        isBusy: false,
        currentLat: '4.8200',
        currentLng: '7.0600',
        totalDeliveries: 38,
        totalAmount: '98000'
      }
    ];

    const createdRiders = [];
    for (const riderData of ridersData) {
      const [rider] = await db.insert(users).values(riderData).returning().onConflictDoNothing();
      if (rider) {
        console.log(`✅ Rider created: ${riderData.email} / rider123`);
        createdRiders.push(rider);
      }
    }
    console.log('');

    // Get rider for assignment
    const [firstRider] = await db.select().from(users).where(eq(users.role, 'rider')).limit(1);
    // 3. Create Sample Orders
    console.log('📦 Creating sample orders...');
    
    const ordersData = [
      {
        ticketId: `NZ-${Math.floor(1000 + Math.random() * 9000)}`,
        pickupAddress: '44 Nsukka Street, Mile 1 Diobu, Port Harcourt',
        pickupLat: '4.8156',
        pickupLng: '7.0498',
        dropoffAddress: '10 Ekengwon Street, Oroazi, Port Harcourt',
        dropoffLat: '4.8200',
        dropoffLng: '7.0600',
        senderName: 'Alice Johnson',
        senderPhone: '+2348011111111',
        recipientName: 'Bob Williams',
        recipientPhone: '+2348022222222',
        description: 'Important documents',
        distanceKm: '5.2',
        totalPrice: '1124',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'pending',
        pickupType: 'immediate'
      },
      {
        ticketId: `NZ-${Math.floor(1000 + Math.random() * 9000)}`,
        pickupAddress: 'Trans Amadi Industrial Layout, Port Harcourt',
        pickupLat: '4.8015',
        pickupLng: '7.0334',
        dropoffAddress: 'Rumuola, Port Harcourt',
        dropoffLat: '4.8421',
        dropoffLng: '7.0012',
        senderName: 'Tech Store PH',
        senderPhone: '+2348033333333',
        recipientName: 'Jane Doe',
        recipientPhone: '+2348044444444',
        recipientEmail: 'jane@example.com',
        description: 'Laptop - Handle with care',
        distanceKm: '8.5',
        totalPrice: '1520',
        paymentMethod: 'paystack',
        paymentStatus: 'paid',
        status: 'assigned',
        riderId: firstRider?.id,
        pickupType: 'immediate'
      },
      {
        ticketId: `NZ-${Math.floor(1000 + Math.random() * 9000)}`,
        pickupAddress: 'Eleme Junction, Port Harcourt',
        pickupLat: '4.7924',
        pickupLng: '7.1064',
        dropoffAddress: 'Olu Obasanjo Road, Port Harcourt',
        dropoffLat: '4.8123',
        dropoffLng: '7.0456',
        senderName: 'Fashion Boutique',
        senderPhone: '+2348055555555',
        recipientName: 'Mary Smith',
        recipientPhone: '+2348066666666',
        description: 'Fashion items',
        distanceKm: '12.3',
        totalPrice: '1976',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'picked_up',
        riderId: firstRider?.id,
        pickedUpAt: new Date(Date.now() - 30 * 60000), // 30 mins ago
        pickupType: 'immediate'
      },
      {
        ticketId: `NZ-${Math.floor(1000 + Math.random() * 9000)}`,
        pickupAddress: 'Aggrey Road, Port Harcourt',
        pickupLat: '4.8245',
        pickupLng: '7.0123',
        dropoffAddress: 'Ada George Road, Port Harcourt',
        dropoffLat: '4.8567',
        dropoffLng: '6.9876',
        senderName: 'Food Delivery Co',
        senderPhone: '+2348077777777',
        recipientName: 'Peter Parker',
        recipientPhone: '+2348088888888',
        description: 'Food package',
        distanceKm: '6.8',
        totalPrice: '1316',
        paymentMethod: 'cod',
        paymentStatus: 'paid',
        status: 'delivered',
        riderId: firstRider?.id,
        pickedUpAt: new Date(Date.now() - 120 * 60000), // 2 hours ago
        deliveredAt: new Date(Date.now() - 90 * 60000), // 1.5 hours ago
        pickupType: 'immediate'
      },
      {
        ticketId: `NZ-${Math.floor(1000 + Math.random() * 9000)}`,
        pickupAddress: 'GRA Phase 2, Port Harcourt',
        pickupLat: '4.8334',
        pickupLng: '7.0201',
        dropoffAddress: 'Woji, Port Harcourt',
        dropoffLat: '4.8490',
        dropoffLng: '7.0567',
        senderName: 'Corporate Office',
        senderPhone: '+2348099999999',
        recipientName: 'James Bond',
        recipientPhone: '+2348088887777',
        description: 'Contract documents',
        distanceKm: '4.5',
        totalPrice: '1040',
        paymentMethod: 'paystack',
        paymentStatus: 'paid',
        status: 'pending',
        pickupType: 'scheduled',
        scheduledPickupAt: new Date(Date.now() + 3 * 60 * 60000) // 3 hours from now
      }
    ];

    for (const orderData of ordersData) {
      await db.insert(orders).values(orderData).onConflictDoNothing();
      console.log(`✅ Order created: ${orderData.ticketId} - Status: ${orderData.status}`);
    }
    console.log('');

    console.log('✅ Database seeding completed!\n');
    console.log('📝 Login Credentials:');
    console.log('   Admin:  admin@nizelogistics.com / admin123');
    console.log('   Rider1: rider1@nizelogistics.com / rider123');
    console.log('   Rider2: rider2@nizelogistics.com / rider123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
