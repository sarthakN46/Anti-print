import dotenv from 'dotenv';
// Load environment variables BEFORE anything else
dotenv.config(); // Load from local .env

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import shopRoutes from './routes/shopRoutes'; 
import uploadRoutes from './routes/uploadRoutes'; 
import orderRoutes from './routes/orderRoutes';
import { initSocket } from './utils/socket';
import runCleanup from './cron';

// 1. Initialize App
const app = express();
const server = http.createServer(app);

// 2. Connect to Database
connectDB();

// 2.1 Start Cleanup Job
runCleanup();

// 3. Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

initSocket(io);

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  socket.on('join_shop', (shopId) => {
    socket.join(shopId);
    console.log(`Socket ${socket.id} joined shop ${shopId}`);
  });

  socket.on('join_user', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined user ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to our routes
app.set('io', io);

// 4. Middleware (The "Security Guards")
app.use(express.json()); // Allow app to parse JSON bodies
app.use(cors({
  origin: process.env.CLIENT_URL || "*"
}));         // Allow frontend to talk to backend
app.use(helmet());       // Secure HTTP headers
app.use(morgan('dev'));  // Log requests to console
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);

// 5. Basic Health Check Route
app.get('/', (req, res) => {
  res.send({ 
    status: 'Active', 
    system: 'XeroxSaaS Backend', 
    timestamp: new Date() 
  });
});

// 6. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});