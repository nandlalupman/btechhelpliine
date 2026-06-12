const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const User = require('../models/User');
const emailUtils = require('../utils/email');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const { getJwtSecret } = require('../config/jwt');

// Optional authentication helper for lead submissions
const optionalVerifyToken = async (req, res, next) => {
  let token = '';
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, await getJwtSecret());
    const user = await User.findById(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch (err) {
    // Ignore invalid token and treat as anonymous submission
    req.user = null;
  }
  next();
};

// POST / — Submit a lead (Anonymous or Logged In)
router.post(
  '/',
  optionalVerifyToken,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('mobile')
      .isLength({ min: 10, max: 10 })
      .withMessage('Mobile number must be exactly 10 digits')
      .matches(/^\d{10}$/)
      .withMessage('Enter a valid 10-digit mobile number'),
    body('branch').trim().notEmpty().withMessage('Preferred branch is required'),
    body('state').trim().notEmpty().withMessage('Preferred state is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, mobile, branch, state, budget, category, message } = req.body;

    try {
      const leadData = {
        name,
        phone: mobile,
        preferredBranch: branch,
        preferredState: state,
        budget: budget || 'Not Specified',
        category: category || 'General',
        message: message || '',
        source: req.user ? 'student_portal' : 'website_form',
      };

      // If logged in, associate with user
      if (req.user) {
        leadData.userId = req.user._id;
        // Pre-fill email from user profile if not provided
        leadData.email = req.body.email || req.user.email;
      } else {
        // If anonymous, email is required
        if (!req.body.email) {
          return res.status(400).json({ success: false, error: 'Email is required for anonymous submissions' });
        }
        leadData.email = req.body.email.trim().toLowerCase();
      }

      const lead = new Lead(leadData);
      await lead.save();

      // Send confirmation email
      try {
        await emailUtils.sendLeadConfirmation(leadData.email, name, lead._id);
      } catch (mailErr) {
        console.error('Error sending lead confirmation email:', mailErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Your consultation request has been submitted successfully!',
        data: { leadId: lead._id },
      });
    } catch (err) {
      console.error('Lead submission error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /:id — Get single lead status (Authenticated Student Owner, Counsellor, or Admin)
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const lead = await Lead.findById(id)
      .populate('userId', 'name email phone')
      .populate('assignedTo', 'name email phone');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Authorization checks:
    // 1. Admin can see anything
    // 2. Counsellor can see it if it's assigned to them (or any lead depending on permissions, but let's restrict to assigned or admin)
    // 3. Student can see it if it's their own lead
    const isOwner = lead.userId && lead.userId._id.toString() === req.user.userId.toString();
    const isAssignedCounsellor = lead.assignedTo && lead.assignedTo._id.toString() === req.user.userId.toString();
    const isAdmin = req.user.role === 'admin';
    const isCounsellor = req.user.role === 'counsellor';

    if (!isOwner && !isAdmin && (!isCounsellor || !isAssignedCounsellor)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
    }

    // If student, filter out notes for privacy or keep it simple
    const responseData = lead.toObject();
    if (req.user.role === 'student') {
      delete responseData.notes; // Hide counsellor notes from student
    }

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('Fetch lead detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
