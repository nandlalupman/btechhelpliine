const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const emailUtils = require('../utils/email');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'btech-helpline-default-secret-key-999!';

// ── Endpoints ──

// POST /register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('phone')
      .isLength({ min: 10, max: 10 })
      .withMessage('Phone number must be exactly 10 digits')
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid Indian mobile number'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, email, phone, password, jeeRank, preferredBranch, preferredState } = req.body;

    try {
      // Check if email already exists
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Email is already registered' });
      }

      // Check if phone already exists
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ success: false, error: 'Phone number is already registered' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user (auto-verified)
      const user = new User({
        name,
        email,
        phone,
        password: hashedPassword,
        isVerified: true,
        jeeRank: jeeRank || '',
        preferredBranch: preferredBranch || '',
        preferredState: preferredState || '',
      });

      await user.save();

      // Sign JWT (auto-login on registration)
      const token = jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        JWT_SECRET
      );

      res.status(201).json({
        success: true,
        message: 'Registration successful!',
        token,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Registration error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// POST /login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, error: 'Account deactivated. Please contact support.' });
      }

      // Match password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Sign JWT (no expiration for persistent sessions)
      const token = jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        JWT_SECRET
      );

      res.json({
        success: true,
        token,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      // Redirect to login page with a query parameter showing verification failed
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login.html?verified=false`);
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login.html?verified=true`);
  } catch (err) {
    console.error('Verification error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login.html?verified=false`);
  }
});

// POST /forgot-password
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Enter a valid email address')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Return success message even if email doesn't exist for security
        return res.json({ success: true, message: 'Password reset link sent to your email if registered.' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
      await user.save();

      // Send email
      try {
        await emailUtils.sendPasswordResetEmail(email, user.name, resetToken);
      } catch (mailErr) {
        console.error('Error sending reset email:', mailErr.message);
      }

      res.json({ success: true, message: 'Password reset link sent to your email if registered.' });
    } catch (err) {
      console.error('Forgot password error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// POST /reset-password/:token
router.post(
  '/reset-password/:token',
  [
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { token } = req.params;
    const { password } = req.body;

    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({ success: false, error: 'Password reset token is invalid or has expired.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
      console.error('Reset password error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

module.exports = router;
