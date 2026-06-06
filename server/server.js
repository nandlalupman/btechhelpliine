require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Enforce secure JWT_SECRET in production mode
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'btech-helpline-default-secret-key-999!') {
    console.error('CRITICAL SECURITY ERROR: JWT_SECRET is not configured or uses a weak default secret in production.');
    process.exit(1);
  }
}

const app = express();

// Connect to MongoDB
connectDB();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disables strict CSP for easier local integration of CDN libraries
}));

// CORS setup
const whitelist = [
  'https://www.btechhelpline.com',
  'https://btechhelpline.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Global Rate Limiting (15 minutes, 100 requests per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests from this IP. Please try again after 15 minutes.' },
});
app.use(globalLimiter);

// Auth Rate Limiting (15 minutes, 15 requests per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, error: 'Too many auth attempts. Please try again after 15 minutes.' },
});

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '10kb' })); // Guard against giant JSON bodies
app.use(morgan('dev'));

// Static files fallback (allows monolithic local serving for testing/debugging)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/user', require('./routes/user'));
app.use('/api/counsellor', require('./routes/counsellor'));
app.use('/api/admin', require('./routes/admin'));

// Health check API
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Fallback to index.html for unknown frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

module.exports = app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode at http://localhost:${PORT}`);
  });
}

