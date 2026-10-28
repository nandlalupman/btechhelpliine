const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const User = require('../models/User');
const emailUtils = require('../utils/email');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const crypto = require('crypto');
const { hashKey, studentView } = require('../services/conversations');
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
    body('name').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Enter your name, up to 100 characters'),
    body('mobile')
      .isLength({ min: 10, max: 10 })
      .withMessage('Mobile number must be exactly 10 digits')
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Enter a valid 10-digit mobile number'),
    body('branch').isString().trim().notEmpty().isLength({ max: 120 }).withMessage('Preferred branch is required, up to 120 characters'),
    body('state').isString().trim().notEmpty().isLength({ max: 80 }).withMessage('Preferred state is required, up to 80 characters'),
    body('subject').optional().isString().trim().isLength({ min: 1, max: 160 }),
    body('jeeRank').optional({ checkFalsy: true }).isInt({ min: 1, max: 10000000 }).withMessage('Enter a valid positive rank'),
    body('exam').optional().isString().trim().isLength({ max: 80 }),
    body('homeState').optional().isString().trim().isLength({ max: 80 }),
    body('preferredContactTime').optional().isString().trim().isLength({ max: 120 }),
    body('contactConsent').custom(value => value === true).withMessage('Please agree to contact about your request.'),
    body('partnerConsent').optional().isBoolean({ strict: true }),
    body('email').optional({ checkFalsy: true }).isString().trim().isEmail().isLength({ max: 254 }).withMessage('Enter a valid email address'),
    body('message').optional().isString().isLength({ max: 2000 }),
    body('category').optional().isString().isLength({ max: 60 }),
    body('budget').optional().isString().isLength({ max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, mobile, branch, state, budget, category, message, jeeRank, exam, homeState, contactConsent, partnerConsent, preferredContactTime } = req.body;

    try {
      const accessKey = crypto.randomBytes(32).toString('hex');
      const leadData = {
        name,
        phone: mobile,
        preferredBranch: branch,
        preferredState: state,
        budget: budget || 'Not Specified',
        category: category || 'General',
        message: message || '',
        subject: req.body.subject || 'Admission counselling',
        trackingTokenHash: hashKey(accessKey),
        source: req.user ? 'student_portal' : 'website_form',
        jeeRank: jeeRank ? String(jeeRank) : '',
        exam: exam || '',
        homeState: homeState || '',
        preferredContactTime: preferredContactTime || '',
        contactConsent: contactConsent === true,
        partnerConsent: partnerConsent === true,
        consentAt: contactConsent === true ? new Date() : null,
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
        await emailUtils.sendLeadConfirmation(leadData.email, name, lead._id, accessKey);
      } catch (mailErr) {
        console.error('Error sending lead confirmation email:', mailErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Your consultation request has been submitted successfully!',
        data: { leadId: lead._id, accessKey },
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
      return res.json({ success: true, data: studentView(responseData) });
    }

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('Fetch lead detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
