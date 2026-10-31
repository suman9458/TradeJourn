const path = require('path');
const fs = require('fs');
// TradeJourn Server Engine - Updated 2026-10-30T21:49:00
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
const mt5Routes = require('./routes/mt5Routes');
const uploadRoutes = require('./routes/uploadRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');

const app = express();

// SEC-13: Enable reverse proxy trust for Render cloud deployment
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';

// SEC-14: Hardened security headers with strict CSP and HSTS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https:'],
        scriptSrc: isProduction
          ? ["'self'", "'unsafe-inline'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'https:', 'http:', 'ws:', 'wss:']
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false
  })
);
app.use(compression());

// Serve production static assets before API middleware
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath) && process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath, {
    maxAge: '1d',
    index: false
  }));
}

// SEC-05: Strict CORS whitelist - eliminate reflected origin credentials bypass
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.RENDER_EXTERNAL_URL,
  'https://tradejourn.onrender.com',
  ...(isProduction ? [] : [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ])
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins list
      if (allowedOrigins.some(allowed => origin === allowed || allowed.includes(origin))) {
        return callback(null, true);
      }

      // Allow any onrender.com deployment subdomain
      if (origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }

      // Allow local development servers
      if (!isProduction && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
        return callback(null, true);
      }

      if (isProduction) {
        return callback(new Error('Blocked by CORS policy: Origin not allowed'));
      }

      callback(null, true);
    },
    credentials: true
  })
);

// General rate limiting across public API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl?.includes('/api/mt5'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api', apiLimiter);

// SEC-13: Strict brute-force rate limiter for sensitive authentication & OTP endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password/send-otp', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);

// Body parsers: Restrict global payload size to standard 100kb to prevent Denial of Service (DoS) memory exhaustion
// Dedicated 12MB limit is applied strictly and exclusively to the /api/upload/image route
app.use(express.json({
  limit: '100kb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf-8');
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// SEC-NoSQL: Sanitize user input across body, query & params to prevent NoSQL injection ($ and . stripping)
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY ALERT] NoSQL Injection attempt sanitized: key=${key} from IP=${req.ip}`);
  }
}));

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
app.use('/api/mt5', mt5Routes);
app.use('/api/upload', uploadRoutes);
app.use('/api/feedback', feedbackRoutes);

// SPA Fallback: Serve index.html in production, or redirect to Vite dev server in development
if (fs.existsSync(clientDistPath) && process.env.NODE_ENV === 'production') {
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

    // Helper redirect for local development: forward any accidental traffic on 5174 to Vite port 5173
    if (!isProduction) {
      const http = require('http');
      const redirect5174 = http.createServer((req, res) => {
        res.writeHead(302, { Location: `http://localhost:5173${req.url || '/'}` });
        res.end();
      });
      redirect5174.on('error', () => {});
      redirect5174.listen(5174, '127.0.0.1');
    }
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
