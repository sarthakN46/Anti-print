import dotenv from 'dotenv';
// Load environment variables BEFORE anything else
dotenv.config(); // Load from local .env

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import shopRoutes from './routes/shopRoutes'; 
import uploadRoutes from './routes/uploadRoutes'; 
import orderRoutes from './routes/orderRoutes';
import { initSocket } from './utils/socket';
import runCleanup from './cron';
import {
  globalLimiter,
  authLimiter,
  uploadLimiter,
  paymentLimiter,
  sanitizeInput,
  preventParamPollution,
  initRateLimitStore,
} from './middlewares/securityMiddleware';

// 1. Initialize App
const app = express();
const server = http.createServer(app);

// 2. Connect to Database
connectDB();

// 2.1 Start Cleanup Job
runCleanup();

// 2.2 Initialize Redis for Rate Limiting (async, non-blocking)
initRateLimitStore().catch(err => {
  console.warn('⚠️ Redis rate limiter init failed, using in-memory:', err.message);
});

// 3. Socket.io Setup with Authentication
const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"]
  }
});

initSocket(io);

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string, {
      issuer: 'xerox-saas',
      audience: 'xerox-app',
    });
    socket.data.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;

  // SECURITY: Users can only join their own room
  socket.on('join_user', (requestedUserId) => {
    if (requestedUserId === userId) {
      socket.join(requestedUserId);
    } else {
      socket.emit('error', { message: 'Not authorized to join this room' });
    }
  });

  // SECURITY: Shop rooms — we trust the server to emit to shop rooms
  // The join_shop event should only be allowed for shop staff
  socket.on('join_shop', (shopId) => {
    // For now, allow joining — the auth middleware already verified the user
    // In production, verify the user is staff of this shop via DB lookup
    socket.join(shopId);
  });

  socket.on('disconnect', () => {
    // Cleanup
  });
});

// Make io accessible to our routes
app.set('io', io);

// 4. Security Middleware Stack
// 4.1 Disable technology fingerprinting
app.disable('x-powered-by');

// 4.2 Trust proxy (Docker/Nginx)
app.set('trust proxy', 1);

// 4.3 Body parsing with size limits (prevent payload flooding)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// 4.4 CORS — strict origin, no wildcard in production
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// 4.5 Helmet — secure HTTP headers
app.use(helmet());

// 4.6 NoSQL injection protection
app.use(sanitizeInput);

// 4.7 HTTP parameter pollution protection
app.use(preventParamPollution);

// 4.8 Request logging (dev only — use structured logging in prod)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 5. Rate-Limited Routes
// 5.1 Auth routes (strictest limits — 5 req / 15 min)
app.use('/api/auth', authLimiter, authRoutes);

// 5.2 Upload routes (moderate limits — 20 req / 15 min)
app.use('/api/upload', uploadLimiter, uploadRoutes);

// 5.3 Shop and Order routes (global limits — 100 req / 15 min)
app.use('/api/shops', globalLimiter, shopRoutes);
app.use('/api/orders', globalLimiter, orderRoutes);

// 6. Basic Health Check Route
app.get('/', (_req, res) => {
  res.send({ 
    status: 'Active', 
    system: 'XeroxSaaS Backend',
  });
});

// 7. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`🔒 CORS: ${ALLOWED_ORIGIN}`);
  console.log(`🔒 Rate Limiting: Enabled`);
  console.log(`🔒 NoSQL Sanitization: Enabled`);
  console.log(`🔒 Helmet: Enabled`);
});