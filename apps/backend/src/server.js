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
import { apiLimiter } from './middleware/rateLimit.js';

import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import trackingRouter from './routes/tracking.js';
import riderRouter from './routes/rider.js';
import adminRouter from './routes/admin.js';
import superAdminRouter from './routes/superAdmin.js';
import recipientRouter from './routes/recipient.js';
import paystackRouter from './routes/paystack.js';
import uploadRouter from './routes/upload.js';
import refundsRouter from './routes/refunds.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;
const isProduction = process.env.NODE_ENV === 'production';

// Behind Render/Vercel proxies, trust the first hop so rate limiting and audit
// logs see the real client IP rather than the load balancer's.
app.set('trust proxy', 1);

/* ------------------------------------------------------------ middleware */

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: in production allow only the configured frontend origin. A wildcard
// with credentials enabled is rejected by browsers anyway.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin/server-to-server requests arrive without an Origin header.
      if (!origin) return callback(null, true);
      if (!isProduction || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(morgan(isProduction ? 'combined' : 'dev'));

/**
 * The Paystack webhook must see the raw request body to verify its HMAC
 * signature, so it is mounted BEFORE express.json() parses anything.
 */
app.use('/api/paystack/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/paystack', paystackRouter);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

/* ---------------------------------------------------------------- health */

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Nize Logistics API' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Nize Logistics API — ...Plenty Waka',
    version: '2.0.0',
    endpoints: { health: '/health', api: '/api/*' },
  });
});

/* ------------------------------------------------------------- socket.io */

const io = new SocketServer(server, {
  cors: { origin: isProduction ? allowedOrigins : true, credentials: true },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
setupSocket(io);

/* ---------------------------------------------------------------- routes */

app.use('/api', apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/rider', riderRouter);
app.use('/api/admin', adminRouter);
app.use('/api/super', superAdminRouter);
app.use('/api/recipient', recipientRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/refunds', refundsRouter);

/* ---------------------------------------------------- 404 + error handler */

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, err);
  }

  res.status(status).json({
    // Never leak an internal failure's details to the client in production.
    error: status >= 500 && isProduction ? 'Something went wrong on our side' : err.message || 'Internal server error',
    ...(!isProduction && status >= 500 ? { stack: err.stack } : {}),
  });
});

/* ----------------------------------------------------------------- start */

async function start() {
  try {
    await testConnection();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('⚠️  Database connection failed:', error.message);
    console.log('⚠️  Server will start, but anything touching the database will fail.');
    console.log('💡 Check DATABASE_URL, then run: npm run migrate && npm run seed:demo\n');
  }

  server.listen(PORT, () => {
    console.log(`\n🚀 Nize Logistics API listening on port ${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🌍 Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`💳 Paystack: ${process.env.PAYSTACK_SECRET_KEY ? 'configured' : 'NOT configured'}`);
    console.log(`📧 Email: ${process.env.EMAIL_SERVICE || 'not set'} (${process.env.EMAIL_FROM || 'no sender'})`);
    console.log(`\n...Plenty Waka 🚚\n`);
  });

  try {
    startCronJobs(io);
  } catch (error) {
    console.log('⚠️  Cron jobs not started:', error.message);
  }
}

start().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
