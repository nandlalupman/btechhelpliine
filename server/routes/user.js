const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all user routes
router.use(verifyToken);

// GET /me — Get own profile
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /me — Update profile info
router.put(
  '/me',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone')
      .optional()
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

    const { name, phone, jeeRank, preferredBranch, preferredState } = req.body;

    try {
      const user = await User.findById(req.user.userId);

      if (phone && phone !== user.phone) {
        // Check if phone number is already taken
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
          return res.status(400).json({ success: false, error: 'Phone number is already taken' });
        }
        user.phone = phone;
      }

      if (name) user.name = name;
      if (jeeRank !== undefined) user.jeeRank = jeeRank;
      if (preferredBranch !== undefined) user.preferredBranch = preferredBranch;
      if (preferredState !== undefined) user.preferredState = preferredState;

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          jeeRank: user.jeeRank,
          preferredBranch: user.preferredBranch,
          preferredState: user.preferredState,
        },
      });
    } catch (err) {
      console.error('Update profile error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// PUT /me/password — Change password
router.put(
  '/me/password',
  [
    body('oldPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { oldPassword, newPassword } = req.body;

    try {
      const user = await User.findById(req.user.userId);

      // Verify current password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Incorrect current password' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
      console.error('Change password error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /my-leads — Get own leads
router.get('/my-leads', async (req, res) => {
  try {
    const leads = await Lead.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (err) {
    console.error('Fetch student leads error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /my-leads/:id/status — Update own lead status
router.put(
  '/my-leads/:id/status',
  [
    body('status')
      .isIn(['in_progress', 'counselled', 'dropped', 'closed'])
      .withMessage('Invalid lead status option'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { status } = req.body;

    try {
      const lead = await Lead.findOne({ _id: id, userId: req.user.userId });
      if (!lead) {
        return res.status(404).json({ success: false, error: 'Lead not found or unauthorized' });
      }

      lead.status = status;
      await lead.save();

      res.json({ success: true, message: 'Status updated successfully!', data: lead });
    } catch (err) {
      console.error('Update student lead status error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// DELETE /me — Delete own account
router.delete('/me', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user.userId);
    if (!deletedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete associated leads to keep the database clean
    await Lead.deleteMany({ userId: req.user.userId });

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;

