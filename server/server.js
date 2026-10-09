const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // Fallback if root .env exists
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { connectDB, disconnectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { seedDemoData } = require('./utils/seedData');

// Route imports
const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const playbookRoutes = require('./routes/playbookRoutes');
const goalRoutes = require('./routes/goalRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Security and compression middlewares for high scalability
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return callback(null, true);
      }
      if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
        return callback(null, true);
      }
      callback(null, true); // Fallback to allow for local dev
    },
    credentials: true
  })
);

// Rate limiting to protect against abuse on public endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api', apiLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'TradeJourn MERN API',
    version: '2.0.0'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/playbook', playbookRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/ai', aiRoutes);

// Root route handler: Redirect to frontend dev server or serve production build
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath) && process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.redirect('http://localhost:5173');
  });
}

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedDemoData();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(`🚀 TradeJourn MERN Server running on port ${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ [PORT IN USE] Port ${PORT} is already in use by another running process.`);
        console.error(`   The server is likely already running in another window.`);
      } else {
        console.error('Express server error:', err);
      }
    });

    // Helper redirect: forward any accidental traffic on 5174 to Vite port 5173
    const http = require('http');
    const redirect5174 = http.createServer((req, res) => {
      res.writeHead(302, { Location: `http://localhost:5173${req.url || '/'}` });
      res.end();
    });
    redirect5174.on('error', () => {});
    redirect5174.listen(5174, '127.0.0.1');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Graceful shutdown handlers to flush database state safely
const handleGracefulShutdown = async (signal) => {
  console.log(`\nTradeJourn server received ${signal}. Flushing database & shutting down cleanly...`);
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

startServer();
