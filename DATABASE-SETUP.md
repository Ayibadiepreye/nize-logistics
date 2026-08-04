# 🗄️ DATABASE SETUP GUIDE

## ⚠️ Current Issue: Database Authentication Failed

The database connection is failing with:
```
password authentication failed for user 'neondb_owner'
```

## 🔍 What You Need to Do

### Step 1: Verify Your Neon Database Credentials

1. **Login to Neon Console**: https://console.neon.tech
2. **Select your project**: Find the "Nize Logistics" project
3. **Get Connection String**:
   - Go to Dashboard
   - Click on "Connection Details" or "Connection String"
   - Copy the **full connection string**

### Step 2: Expected Format

Your connection string should look like:
```
postgresql://[username]:[password]@[host]/[database]?sslmode=require
```

Example:
```
postgresql://neondb_owner:npg_ABC123XYZ@ep-wild-base-a1b2c3d4.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 3: Update the .env File

Open this file:
```
c:\Users\bonni\Music\nize test\apps\backend\.env
```

Update the DATABASE_URL line with your **actual** connection string from Neon:
```env
DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@YOUR_HOST/neondb?sslmode=require
```

**Current value in .env:**
```
DATABASE_URL=postgresql://neondb_owner:npg_xWel7FDTz9yw@ep-wild-base-axaxoow4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 4: Run Database Initialization

After updating .env with correct credentials:

```powershell
cd "c:\Users\bonni\Music\nize test\apps\backend"
node init-database.js
```

**Expected Output:**
```
🔌 Connecting to database...
✅ Connected to database
📜 Reading SQL file...
🚀 Executing SQL script...
✅ Database initialized successfully!

📊 Tables created:
  - users
  - invites
  - orders
  - reports
  - pricing_config
  - platform_settings

🎉 Ready to run the application!
```

---

## 🔐 Alternative: Create New Neon Database

If the credentials are lost or expired:

### 1. Create New Neon Project

1. Go to https://console.neon.tech
2. Click "New Project"
3. Name it "Nize Logistics"
4. Select region (US East recommended)
5. Click "Create Project"

### 2. Get New Connection String

After project creation:
1. Copy the connection string shown
2. Save it securely
3. Update your `.env` file

### 3. Initialize Database

Run the initialization script:
```powershell
cd "c:\Users\bonni\Music\nize test\apps\backend"
node init-database.js
```

---

## 📋 What the Database Script Does

The `init-db.sql` script will:

1. ✅ **Drop all existing tables** (complete clean slate)
2. ✅ **Drop all enums** 
3. ✅ **Drop all indexes**
4. ✅ **Create 7 enums** (user_role, user_status, order_status, pickup_type, payment_method, payment_status, email_service)
5. ✅ **Create 6 tables**:
   - `users` - All users (admins, riders)
   - `invites` - Signup invite tokens
   - `orders` - All delivery orders
   - `reports` - Issue reports
   - `pricing_config` - Pricing rules
   - `platform_settings` - System config
6. ✅ **Insert default data**:
   - Base Fare: ₦500
   - Per KM Rate: ₦120
   - Minimum Fare: ₦1000
7. ✅ **Create 13 indexes** for performance

---

## 🎯 Database Schema Summary

### Tables Created

| Table | Columns | Purpose |
|-------|---------|---------|
| **users** | 25 columns | Riders, admins, super admins |
| **invites** | 7 columns | Invite-based signup system |
| **orders** | 44 columns | Complete order lifecycle |
| **reports** | 7 columns | Issue reporting |
| **pricing_config** | 5 columns | Dynamic pricing rules |
| **platform_settings** | 23 columns | System configuration |

### Enums Created

1. **user_role**: super_admin, admin, rider
2. **user_status**: active, suspended, pending_signup
3. **order_status**: pending, assigned, accepted, picked_up, in_transit, delivered, cancelled
4. **pickup_type**: immediate, scheduled
5. **payment_method**: paystack, cod
6. **payment_status**: pending, paid, failed, refunded
7. **email_service**: resend, smtp

---

## 🧪 Test Database Connection

After updating credentials, test the connection:

```powershell
cd "c:\Users\bonni\Music\nize test\apps\backend"
node -e "import { testConnection } from './src/lib/db/index.js'; await testConnection();"
```

**Success Output:**
```
✅ Database connection successful!
```

**Failure Output:**
```
❌ Database connection failed: [error message]
```

---

## 🆘 Troubleshooting

### Error: "password authentication failed"
- ✅ Double-check password in connection string
- ✅ Ensure no extra spaces in .env file
- ✅ Try resetting database password in Neon console
- ✅ Create new database project if needed

### Error: "SSL connection failed"
- ✅ Ensure `?sslmode=require` is at the end of URL
- ✅ Remove `channel_binding=require` if present
- ✅ Use `sslmode=require` not `sslmode=verify-full`

### Error: "database does not exist"
- ✅ Database name should be `neondb` (default)
- ✅ Check project is active in Neon console
- ✅ Verify project region matches connection string

---

## ✅ Once Database is Ready

After successful initialization, you can:

1. **Start Backend:**
   ```powershell
   cd "c:\Users\bonni\Music\nize test\apps\backend"
   npm run dev
   ```

2. **Start Frontend:**
   ```powershell
   cd "c:\Users\bonni\Music\nize test\apps\frontend"
   npm run dev
   ```

3. **Access Platform:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:10000

---

## 📝 Important Notes

- The SQL script **deletes everything** and starts fresh
- Default pricing is set to ₦500 base + ₦120/km (minimum ₦1000)
- No users are created by default - use invite system
- All credentials in .env files are configured and ready
- Database uses UTC timezone by default

---

## 🎉 Next Steps After Database Setup

1. Create first super admin (via invite or manual SQL)
2. Test order creation flow
3. Test payment integration (Paystack test mode)
4. Verify real-time tracking
5. Test rider dashboard
6. Test admin panel

---

**Need Help?**
- Email: nizelogistics26@gmail.com
- Phone: +234 (0) 706 398 0120

**...Plenty Waka! 🚚**
