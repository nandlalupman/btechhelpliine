require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');



// Enforce secure JWT_SECRET in production mode if explicitly set
if (process.env.NODE_ENV === 'production') {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === 'btech-helpline-default-secret-key-999!') {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET is configured to use a weak default secret in production.');
    process.exit(1);
  }
}

const app = express();

// Connect to MongoDB
if (!process.env.VERCEL) {
  connectDB();
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disables strict CSP for easier local integration of CDN libraries
}));

// CORS setup
const whitelist = [
  'https://www.btechhelpline.com',
  'https://btechhelpline.com',
  'https://btechhelpliine.vercel.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || whitelist.includes(origin)) {
        return callback(null, true);
      }
      
      try {
        const url = new URL(origin);
        // Allow any Vercel deployments associated with this project name
        if (
          url.hostname === 'btechhelpliine.vercel.app' ||
          (url.hostname.endsWith('.vercel.app') && url.hostname.startsWith('btechhelpliine'))
        ) {
          return callback(null, true);
        }
      } catch (e) {
        // Invalid URL format
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Global Rate Limiting (15 minutes, 100 requests per IP in production)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  message: { success: false, error: 'Too many requests from this IP. Please try again after 15 minutes.' },
});
app.use('/api', globalLimiter);

// Auth Rate Limiting (15 minutes, 15 requests per IP in production)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 15 : 10000,
  message: { success: false, error: 'Too many auth attempts. Please try again after 15 minutes.' },
});

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '5mb' })); // Supports base64 image uploads for college profiles
morgan.token('safe-path', req => req.path);
app.use(morgan(':method :safe-path :status :response-time ms'));



// Static files fallback (allows monolithic local serving for testing/debugging)
app.use(require('./routes/site'));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

const requireDatabase = (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Online service is temporarily unavailable. Please try again shortly or contact our team.',
    });
  }
  next();
};

// API Routes
app.use('/api/tools', require('./routes/tools'));
app.use('/api/journey', requireDatabase, require('./routes/journey'));
app.use('/api/messages', requireDatabase, require('./routes/messages'));
app.use('/api/dev', require('./routes/local'));
app.use('/api/auth', authLimiter, requireDatabase, require('./routes/auth'));
app.use('/api/leads', requireDatabase, require('./routes/leads'));
app.use('/api/user', requireDatabase, require('./routes/user'));
app.use('/api/counsellor', requireDatabase, require('./routes/counsellor'));
app.use('/api/admin', requireDatabase, require('./routes/admin'));
app.use('/api/colleges', requireDatabase, require('./routes/colleges'));


// Health check API
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'btechhelpline',
    pid: process.pid,
    parentPid: process.ppid,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date(),
  });
});

// Fallback to index.html for unknown frontend routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API route not found' });
  res.status(404).send(require('./views/site').notFound());
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ success: false, error: 'This origin is not allowed.' });
  if (err.code === 11000) return res.status(409).json({ success: false, error: 'This record already exists. Refresh and try again.' });
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, error: 'Please check the submitted fields.' });
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ success: false, error: 'The service could not complete this request. Please try again.' });
});

module.exports = app;

if (!process.env.VERCEL) {
  require('./services/reminders').startReminderWorker();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, process.env.HOST || undefined, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode at http://localhost:${PORT}`);
  });
}

