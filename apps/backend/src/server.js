// Load environment variables FIRST
import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import { testConnection } from './lib/db/index.js';
import { setupSocket } from './socket/index.js';
import { startCronJobs } from './cron/index.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;

// ===== MIDDLEWARE =====
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ===== HEALTH =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Nize Logistics API'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Nize Logistics API - ...Plenty Waka',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/*'
    }
  });
});

// ===== SOCKET.IO =====
const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
setupSocket(io);

// ===== ROUTES =====
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import trackingRouter from './routes/tracking.js';
import riderRouter from './routes/rider.js';
import adminRouter from './routes/admin.js';
import superAdminRouter from './routes/superAdmin.js';
import recipientRouter from './routes/recipient.js';
import paystackRouter from './routes/paystack.js';
import uploadRouter from './routes/upload.js';

app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/rider', riderRouter);
app.use('/api/admin', adminRouter);
app.use('/api/super', superAdminRouter);
app.use('/api/recipient', recipientRouter);
app.use('/api/paystack', paystackRouter);
app.use('/api/upload', uploadRouter);

import refundsRouter from './routes/refunds.js';
app.use('/api/refunds', refundsRouter);

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ===== START =====
async function start() {
  // Try to connect to database (non-blocking)
  try {
    await testConnection();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('⚠️  Database connection failed:', error.message);
    console.log('⚠️  Server will start but database features may not work');
    console.log('💡 Please run: node init-database.js (after fixing credentials)\n');
  }
  
  server.listen(PORT, () => {
    console.log(`\n🚀 Nize Logistics API running on port ${PORT}`);
    console.log(`📡 Socket.io ready for real-time updates`);
    console.log(`🌍 Frontend: ${process.env.FRONTEND_URL}`);
    console.log(`💳 Paystack: ${process.env.PAYSTACK_PUBLIC_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`📧 Email: ${process.env.EMAIL_SERVICE} (${process.env.EMAIL_FROM})`);
    console.log(`\n...Plenty Waka 🚚\n`);
  });
  
  // Only start cron jobs if DB is connected
  try {
    startCronJobs(io);
  } catch (error) {
    console.log('⚠️  Cron jobs not started (database required)');
  }
}

start().catch(console.error);
