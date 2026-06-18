const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const emailUtils = require('../utils/email');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const { getJwtSecret } = require('../config/jwt');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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

      // Create new user (pending verification)
      const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const user = new User({
        name,
        email,
        phone,
        password: hashedPassword,
        isVerified: false,
        emailOtpCode: emailOtp,
        emailOtpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
        jeeRank: jeeRank || '',
        preferredBranch: preferredBranch || '',
        preferredState: preferredState || '',
      });

      await user.save();

      // Send verification email
      try {
        await emailUtils.sendVerificationOTPEmail(email, name, emailOtp);
      } catch (mailErr) {
        console.error('Failed to send verification email:', mailErr.message);
      }

      const responseData = {
        success: true,
        message: 'Registration successful! A verification OTP has been sent to your email.',
        email: user.email
      };

      // Expose OTP in non-production environments for automated testing
      if (process.env.NODE_ENV !== 'production') {
        responseData.otp = emailOtp;
      }

      res.status(201).json(responseData);
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

      // Check if user is verified
      if (!user.isVerified) {
        const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
        user.emailOtpCode = emailOtp;
        user.emailOtpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        try {
          await emailUtils.sendVerificationOTPEmail(user.email, user.name, emailOtp);
        } catch (mailErr) {
          console.error('Failed to send verification email:', mailErr.message);
        }

        const responseData = {
          success: false,
          unverified: true,
          error: 'Please verify your email address. A verification OTP has been sent.',
          email: user.email
        };

        if (process.env.NODE_ENV !== 'production') {
          responseData.otp = emailOtp;
        }

        return res.status(403).json(responseData);
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Sign JWT
      const token = jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        await getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
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
      return res.redirect('/login.html?verified=false');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.redirect('/login.html?verified=true');
  } catch (err) {
    console.error('Verification error:', err.message);
    res.redirect('/login.html?verified=false');
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
      if (!user || !user.isVerified) {
        // Return success message even if email doesn't exist or is not verified for security
        return res.json({ success: true, message: 'Password reset link sent to your email if registered.' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
      await user.save();

      // Send email
      try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        await emailUtils.sendPasswordResetEmail(email, user.name, resetToken, baseUrl);
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
        resetPasswordExpires: { $gt: new Date() },
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

// POST /send-otp
router.post(
  '/send-otp',
  [
    body('phone')
      .isLength({ min: 10, max: 10 })
      .withMessage('Phone number must be exactly 10 digits')
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid Indian mobile number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { phone } = req.body;

    try {
      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(404).json({ success: false, error: 'Phone number is not registered.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, error: 'Account deactivated. Please contact support.' });
      }

      // Generate a 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otp;
      user.otpExpires = Date.now() + 5 * 60 * 1000; // valid for 5 mins
      await user.save();

      // Send OTP via 2Factor API or simulation fallback
      const apiKey = process.env.TWO_FACTOR_API_KEY;
      let sentSuccess = true;
      let gatewayMessage = 'OTP sent successfully via SMS simulation.';

      if (apiKey && apiKey !== 'your-actual-2factor-api-key-here') {
        try {
          // 2Factor.in standard API URL format: https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp_val}/AUTOGEN
          // This triggers the default 2Factor authentication template.
          const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/AUTOGEN`;
          const apiRes = await fetch(url);
          const apiJson = await apiRes.json();
          
          if (apiJson.Status === 'Success') {
            gatewayMessage = 'OTP sent successfully via SMS.';
            console.log(`[2Factor] SMS sent to +91 ${phone}. Details: ${apiJson.Details}`);
          } else {
            console.error('[2Factor] Error response:', apiJson.Details);
            sentSuccess = false;
            gatewayMessage = `SMS provider error: ${apiJson.Details}`;
          }
        } catch (smsErr) {
          console.error('[2Factor] Connection error:', smsErr.message);
          sentSuccess = false;
          gatewayMessage = 'Failed to connect to the SMS gateway.';
        }
      } else {
        // Simulate sending SMS via console log
        console.log(`\n================ SMS GATEWAY SIMULATION ================`);
        console.log(`SENDING OTP TO: +91 ${phone}`);
        console.log(`MESSAGE: Your BtechHelpline login OTP is ${otp}. Valid for 5 minutes.`);
        console.log(`========================================================\n`);
      }

      if (!sentSuccess) {
        return res.status(500).json({ success: false, error: gatewayMessage });
      }

      // In non-production, return it directly in response for easier testing
      const responseData = { success: true, message: gatewayMessage };
      if (process.env.NODE_ENV !== 'production') {
        responseData.otp = otp; // Expose to frontend during dev
      }

      res.json(responseData);
    } catch (err) {
      console.error('Send OTP error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// POST /verify-otp
router.post(
  '/verify-otp',
  [
    body('phone')
      .isLength({ min: 10, max: 10 })
      .withMessage('Phone number must be exactly 10 digits')
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid Indian mobile number'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be exactly 6 digits'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { phone, otp } = req.body;

    try {
      const user = await User.findOne({
        phone,
        otpCode: otp,
        otpExpires: { $gt: new Date() },
      });

      if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, error: 'Account deactivated. Please contact support.' });
      }

      // Clear OTP details
      user.otpCode = undefined;
      user.otpExpires = undefined;
      user.lastLogin = new Date();
      await user.save();

      // Sign JWT
      const token = jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        await getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: 'Login successful via OTP!',
        token,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Verify OTP error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// POST /verify-email-otp
router.post(
  '/verify-email-otp',
  [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be exactly 6 digits'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, otp } = req.body;

    try {
      const user = await User.findOne({
        email: email.toLowerCase(),
        emailOtpCode: otp,
        emailOtpExpires: { $gt: new Date() },
      });

      if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid or expired email OTP code.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, error: 'Account deactivated. Please contact support.' });
      }

      // Clear email OTP details and mark verified
      user.isVerified = true;
      user.emailOtpCode = undefined;
      user.emailOtpExpires = undefined;
      user.lastLogin = new Date();
      await user.save();

      // Sign JWT
      const token = jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        await getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({
        success: true,
        message: 'Email verified successfully!',
        token,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err) {
      console.error('Verify email OTP error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// POST /resend-email-otp
router.post(
  '/resend-email-otp',
  [
    body('email').isEmail().withMessage('Enter a valid email address')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email } = req.body;

    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ success: false, error: 'Email address not found.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, error: 'Account deactivated. Please contact support.' });
      }

      // Generate a new 6-digit OTP code
      const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailOtpCode = emailOtp;
      user.emailOtpExpires = Date.now() + 10 * 60 * 1000; // valid for 10 mins
      await user.save();

      // Send verification email
      try {
        await emailUtils.sendVerificationOTPEmail(user.email, user.name, emailOtp);
      } catch (mailErr) {
        console.error('Failed to send verification email:', mailErr.message);
      }

      const responseData = {
        success: true,
        message: 'A new verification OTP has been sent to your email.'
      };

      if (process.env.NODE_ENV !== 'production') {
        responseData.otp = emailOtp;
      }

      res.json(responseData);
    } catch (err) {
      console.error('Resend email OTP error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

module.exports = router;
