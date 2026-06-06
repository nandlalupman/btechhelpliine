const express = require('express');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const emailUtils = require('../utils/email');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply auth + role checks to all counsellor endpoints
router.use(verifyToken);
router.use(requireRole('counsellor', 'admin'));

// GET /leads — View leads assigned to this counsellor
router.get('/leads', async (req, res) => {
  try {
    const leads = await Lead.find({ assignedTo: req.user.userId }).sort({ updatedAt: -1 });
    res.json({ success: true, data: leads });
  } catch (err) {
    console.error('Counsellor fetch leads error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /leads/:id — View single lead detail
router.get('/leads/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const lead = await Lead.findById(id)
      .populate('userId', 'name email phone jeeRank preferredBranch preferredState')
      .populate('assignedTo', 'name email phone');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Gating check: Counsellor must be assigned to this lead, unless they are admin
    if (req.user.role !== 'admin' && lead.assignedTo && lead.assignedTo._id.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden: Lead is assigned to another counsellor' });
    }

    res.json({ success: true, data: lead });
  } catch (err) {
    console.error('Counsellor fetch lead detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /leads/:id/status — Update lead status
router.put(
  '/leads/:id/status',
  [body('status').isIn(['new', 'contacted', 'in_progress', 'counselled', 'closed', 'dropped']).withMessage('Invalid status')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { status } = req.body;

    try {
      const lead = await Lead.findById(id);
      if (!lead) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      // Check assignment
      if (req.user.role !== 'admin' && lead.assignedTo && lead.assignedTo.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ success: false, error: 'Forbidden: Lead is assigned to another counsellor' });
      }

      lead.status = status;
      await lead.save();

      // Trigger status update email
      try {
        await emailUtils.sendStatusUpdateEmail(lead.email, lead.name, status);
      } catch (mailErr) {
        console.error('Error sending status update email:', mailErr.message);
      }

      res.json({ success: true, message: 'Status updated successfully', data: lead });
    } catch (err) {
      console.error('Update status error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// POST /leads/:id/notes — Add note to lead
router.post(
  '/leads/:id/notes',
  [body('text').trim().notEmpty().withMessage('Note content cannot be empty')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { text } = req.body;

    try {
      const lead = await Lead.findById(id);
      if (!lead) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      // Check assignment
      if (req.user.role !== 'admin' && lead.assignedTo && lead.assignedTo.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ success: false, error: 'Forbidden: Lead is assigned to another counsellor' });
      }

      lead.notes.push({
        text,
        addedBy: req.user.userId,
      });

      await lead.save();

      // Get updated lead with populated note creators
      const updatedLead = await Lead.findById(id)
        .populate('notes.addedBy', 'name role');

      res.status(201).json({
        success: true,
        message: 'Note added successfully',
        data: updatedLead.notes,
      });
    } catch (err) {
      console.error('Add note error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /stats — View counsellor performance stats
router.get('/stats', async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments({ assignedTo: req.user.userId });
    const openLeads = await Lead.countDocuments({
      assignedTo: req.user.userId,
      status: { $in: ['new', 'contacted', 'in_progress'] },
    });
    const completedLeads = await Lead.countDocuments({
      assignedTo: req.user.userId,
      status: 'counselled',
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        openLeads,
        completedLeads,
        performanceRate: totalLeads > 0 ? Math.round((completedLeads / totalLeads) * 100) + '%' : '0%',
      },
    });
  } catch (err) {
    console.error('Fetch counsellor stats error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
