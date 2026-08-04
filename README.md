# Nize Logistics - ...Plenty Waka 🚚

A modern, full-stack logistics and delivery management platform built for Nigeria.

[![Deploy Frontend](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Ayibadiepreye/nize-logistics)

## 🚀 Features

### For Customers
- 📦 **Create Orders** - Simple order creation with address input
- 💳 **Paystack Integration** - Secure online payments or cash on delivery
- 📍 **Real-time Tracking** - Live order tracking with map
- 🎫 **Unique Ticket IDs** - Easy order reference
- 📧 **Email Notifications** - Order updates via email
- 📱 **Mobile Responsive** - Works on all devices

### For Riders
- 🗺️ **Live Dashboard** - View assigned deliveries
- ✅ **Accept/Reject Jobs** - Control your workload
- 📍 **Location Tracking** - Real-time GPS updates
- 💰 **Earnings Tracker** - Daily and total earnings
- 🔔 **Real-time Notifications** - Instant job alerts
- ⚡ **Online/Offline Toggle** - Control availability

### For Admins
- 👥 **User Management** - Invite and manage riders/admins
- 📊 **Analytics Dashboard** - Orders, revenue, and rider stats
- 🚴 **Rider Assignment** - Assign orders to available riders
- 💸 **Payment Tracking** - Monitor payments and refunds
- 🎨 **Modern UI** - Dark mode support

### For Super Admins
- 🔐 **Full System Access** - Complete platform control
- 👑 **Admin Management** - Create and manage admins
- 📈 **System Analytics** - Platform-wide insights

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Custom CSS with CSS Variables
- **Maps:** Leaflet + OpenStreetMap
- **Real-time:** Socket.io Client
- **Payments:** Paystack

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Real-time:** Socket.io
- **Authentication:** JWT + bcrypt
- **File Upload:** Multer + Cloudinary
- **Payments:** Paystack

## 📁 Project Structure

```
nize-logistics/
├── apps/
│   ├── frontend/          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/       # App router pages
│   │   │   ├── components/# React components
│   │   │   └── lib/       # Utilities
│   │   └── public/        # Static assets
│   │
│   └── backend/           # Express backend
│       ├── src/
│       │   ├── routes/    # API routes
│       │   ├── middleware/# Express middleware
│       │   ├── socket/    # Socket.io handlers
│       │   ├── cron/      # Scheduled jobs
│       │   └── lib/       # Database & utilities
│       └── init-db.sql    # Database schema
│
├── DEPLOYMENT.md          # Deployment guide
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/Ayibadiepreye/nize-logistics.git
cd nize-logistics
```

### 2. Setup Backend
```bash
cd apps/backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your values

# Initialize database
psql -U postgres -d your_database < init-db.sql

# Start backend
npm run dev
```

### 3. Setup Frontend
```bash
cd apps/frontend
npm install

# Create .env.local file
cp .env.local.example .env.local
# Edit .env.local with your values

# Start frontend
npm run dev
```

### 4. Access the Application
- Frontend: http://localhost:3000
- Backend: http://localhost:10000

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

**Frontend (Vercel):**
1. Push code to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

**Backend (Render):**
1. Push code to GitHub
2. Create Web Service on Render
3. Set environment variables
4. Deploy

## 🔐 Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
```

## 📊 Database Schema

The platform uses PostgreSQL with the following main tables:
- `users` - All users (customers, riders, admins)
- `orders` - Delivery orders
- `payments` - Payment records
- `refunds` - Refund requests
- `invite_tokens` - Invite system
- `notifications` - Push notifications

## 🎨 Features in Detail

### Real-time Updates
- Socket.io for instant notifications
- Live order tracking
- Rider location updates every 10 seconds

### Payment System
- Paystack integration
- Cash on Delivery option
- Automatic payment verification
- Refund management

### Security
- JWT authentication
- Password hashing with bcrypt
- CORS protection
- Helmet.js security headers
- Role-based access control

### User Roles
1. **Customer** - Create and track orders
2. **Rider** - Accept and deliver orders
3. **Admin** - Manage orders and riders
4. **Super Admin** - Full system access

## 🧪 Testing

```bash
# Frontend
cd apps/frontend
npm run build  # Test production build

# Backend
cd apps/backend
npm start      # Test server starts
```

## 📝 API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup/:token` - Signup with invite

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/:orderId` - Get order details
- `GET /api/tracking/:ticketId` - Track order

### Rider
- `GET /api/rider/dashboard` - Rider dashboard
- `POST /api/rider/toggle-online` - Toggle availability
- `POST /api/rider/accept/:orderId` - Accept order

### Admin
- `GET /api/admin/dashboard` - Admin dashboard
- `POST /api/admin/invite` - Invite user
- `POST /api/admin/assign` - Assign order to rider

## 🐛 Known Issues

- Address search requires network access to OpenStreetMap
- Free tier hosting may have cold starts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Ayiba Diepreye**
- GitHub: [@Ayibadiepreye](https://github.com/Ayibadiepreye)

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Paystack for payment processing
- OpenStreetMap for mapping
- Render & Vercel for hosting

## 📞 Support

For support, email support@nizelogistics.com or open an issue on GitHub.

---

Built with ❤️ in Nigeria
