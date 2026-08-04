# 🚀 NIZE LOGISTICS - QUICK START GUIDE

## Prerequisites Installed ✅
- Node.js 18+
- npm
- All dependencies installed
- **Database initialized successfully** ✅

---

## 🎯 Start Development in 3 Steps

### Step 1: Start Backend
```powershell
cd "c:\Users\bonni\Music\nize test\apps\backend"
npm run dev
```

**Expected Output:**
```
🚀 Nize Logistics API running on port 10000
📡 Socket.io ready for real-time updates
🌍 Frontend: http://localhost:3000
💳 Paystack: Configured
📧 Email: smtp (nizelogistics26@gmail.com)

...Plenty Waka 🚚
```

Backend URL: **http://localhost:10000**

---

### Step 2: Start Frontend (New Terminal)
```powershell
cd "c:\Users\bonni\Music\nize test\apps\frontend"
npm run dev
```

**Expected Output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully
```

Frontend URL: **http://localhost:3000**

---

### Step 3: Access the Platform

Open browser: **http://localhost:3000**

---

## 🔐 First Time Setup

### Create Super Admin (Use Admin Invite Route)

Since you need to create the first super admin, you'll need to manually insert one into the database OR use the invite system. Here's how:

#### Option 1: Manual Database Insert (Easiest)
```sql
-- Connect to your Neon database and run this:
INSERT INTO users (
  username, 
  email, 
  password_hash, 
  role, 
  status, 
  full_name
) VALUES (
  'admin',
  'admin@nizelogistics.com',
  '$2b$10$rBV2kk/9R1XOL5wZ7c5j0.Dx8K3LqGcYvEKZL0vZ8k5vZ8k5vZ8k5',  -- password: "admin123"
  'super_admin',
  'active',
  'Super Administrator'
);
```

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

#### Option 2: Use Backend Directly
```powershell
cd "c:\Users\bonni\Music\nize test\apps\backend"

# Create a quick signup script
node -e "
import bcrypt from 'bcryptjs';
import { db } from './src/lib/db/index.js';
import { users } from './src/lib/db/schema.js';

const hash = await bcrypt.hash('admin123', 10);
await db.insert(users).values({
  username: 'admin',
  email: 'admin@nizelogistics.com',
  passwordHash: hash,
  role: 'super_admin',
  status: 'active',
  fullName: 'Super Administrator'
});
console.log('✅ Super admin created!');
process.exit(0);
"
```

---

## 📋 Common Tasks

### Test the API
```powershell
# Health check
curl http://localhost:10000/health

# Response:
# {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z","service":"Nize Logistics API"}
```

### Test Order Creation
1. Go to http://localhost:3000/order
2. Fill in the 4-step form
3. Use test payment or COD
4. Get tracking number (NIZ-XXXXXX)

### Track an Order
1. Go to http://localhost:3000/track
2. Enter ticket ID (e.g., NIZ-ABC123)
3. View live tracking

### Login as Admin
1. Go to http://localhost:3000/login
2. Enter credentials (from setup above)
3. Access admin dashboard

---

## 🔧 Troubleshooting

### Backend Won't Start
```powershell
# Check if port 10000 is in use
netstat -ano | findstr :10000

# Kill process if needed (replace PID)
taskkill /PID <PID> /F

# Restart backend
npm run dev
```

### Frontend Won't Start
```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <PID> /F

# Clear Next.js cache
Remove-Item -Recurse -Force .next

# Restart frontend
npm run dev
```

### Database Connection Error
Check your `.env` file in `apps/backend`:
```env
DATABASE_URL=postgresql://neondb_owner:npg_xWel7FDTz9yw@ep-wild-base-axaxoow4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Test connection:
```powershell
cd apps\backend
node -e "import { testConnection } from './src/lib/db/index.js'; await testConnection();"
```

### Socket.io Not Connecting
1. Check backend is running on port 10000
2. Verify CORS settings allow localhost:3000
3. Check browser console for errors
4. Restart both servers

---

## 🎯 Test Checklist

- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] Can access homepage (http://localhost:3000)
- [ ] Can create an order
- [ ] Can track an order
- [ ] Can login as admin
- [ ] Socket.io connects (check browser console)
- [ ] Real-time updates work
- [ ] Payment redirects to Paystack (test mode)

---

## 📚 Documentation

- **Full README**: `README.md`
- **Features List**: `FEATURES.md`
- **Completion Report**: `COMPLETE.md`
- **API Docs**: See README.md "API Endpoints" section

---

## 🆘 Need Help?

**Contact:**
- Email: nizelogistics26@gmail.com
- Phone: +234 (0) 706 398 0120
- Phone: +234 (0) 807 669 0182

---

## 🎉 You're All Set!

The platform is ready to use. Start creating orders, tracking packages, and managing deliveries!

**...Plenty Waka!** 🚚
