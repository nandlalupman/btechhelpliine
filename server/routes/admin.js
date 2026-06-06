const express = require('express');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply auth + admin check to all admin routes
router.use(verifyToken);
router.use(requireRole('admin'));

// GET /leads — Fetch all leads with filters & search
router.get('/leads', async (req, res) => {
  const { status, priority, assignedTo, search, limit = 50, skip = 0 } = req.query;

  const query = {};

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;

  if (search) {
    const searchStr = typeof search === 'string' ? search.trim() : '';
    if (searchStr) {
      const searchRegex = new RegExp(searchStr, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }
  }

  try {
    const leads = await Lead.find(query)
      .populate('userId', 'name email phone')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    const totalCount = await Lead.countDocuments(query);

    res.json({
      success: true,
      data: {
        leads,
        total: totalCount,
      },
    });
  } catch (err) {
    console.error('Admin fetch leads error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /leads/export — Export leads to CSV
router.get('/leads/export', async (req, res) => {
  try {
    const leads = await Lead.find({})
      .populate('userId', 'name email')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    let csv = 'Lead ID,Student Name,Email,Phone,JEE Rank,Category,Branch,State,Budget,Status,Priority,Assigned Counsellor,Source,Date Created\n';

    leads.forEach((l) => {
      const row = [
        l._id,
        `"${l.name.replace(/"/g, '""')}"`,
        `"${l.email}"`,
        `"${l.phone}"`,
        `"${l.jeeRank}"`,
        `"${l.category}"`,
        `"${l.preferredBranch}"`,
        `"${l.preferredState}"`,
        `"${l.budget}"`,
        l.status,
        l.priority,
        `"${l.assignedTo ? l.assignedTo.name.replace(/"/g, '""') : 'Unassigned'}"`,
        l.source,
        l.createdAt.toISOString(),
      ].join(',');
      csv += row + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export CSV error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /leads/:id — Get full lead detail
router.get('/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('userId', 'name email phone jeeRank preferredBranch preferredState')
      .populate('assignedTo', 'name email')
      .populate('notes.addedBy', 'name role');

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: lead });
  } catch (err) {
    console.error('Admin fetch lead detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /leads/:id — Edit any field on a lead
router.put('/leads/:id', async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedLead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, message: 'Lead updated successfully', data: updatedLead });
  } catch (err) {
    console.error('Admin update lead error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// DELETE /leads/:id — Delete lead
router.delete('/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('Admin delete lead error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /leads/:id/assign — Assign to counsellor
router.put(
  '/leads/:id/assign',
  [body('assignedTo').custom(value => value === null || typeof value === 'string').withMessage('Invalid assignment value')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { assignedTo } = req.body;

    try {
      const lead = await Lead.findById(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      if (assignedTo) {
        const counsellor = await User.findById(assignedTo);
        if (!counsellor || !['counsellor', 'admin'].includes(counsellor.role)) {
          return res.status(400).json({ success: false, error: 'User is not a valid counsellor' });
        }
        lead.assignedTo = assignedTo;
      } else {
        lead.assignedTo = null;
      }

      await lead.save();
      res.json({ success: true, message: 'Lead assigned successfully', data: lead });
    } catch (err) {
      console.error('Admin assign lead error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /users — Fetch all users
router.get('/users', async (req, res) => {
  const { role, search } = req.query;
  const query = {};

  if (role) query.role = role;
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
  }

  try {
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Admin fetch users error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /users/:id — Get user detail
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Admin fetch user detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /users/:id/role — Change user role
router.put(
  '/users/:id/role',
  [body('role').isIn(['student', 'counsellor', 'admin']).withMessage('Invalid role')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { role } = req.body;

    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      user.role = role;
      await user.save();

      res.json({ success: true, message: `Role updated to ${role} successfully`, data: user });
    } catch (err) {
      console.error('Admin update role error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// PUT /users/:id/status — Toggle user active/deactive status
router.put(
  '/users/:id/status',
  [body('isActive').isBoolean().withMessage('isActive must be a boolean')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { isActive } = req.body;

    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Prevent self deactivation
      if (user._id.toString() === req.user.userId.toString()) {
        return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
      }

      user.isActive = isActive;
      await user.save();

      res.json({
        success: true,
        message: `User account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: user,
      });
    } catch (err) {
      console.error('Admin toggle status error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /stats — Full analytics
router.get('/stats', async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments();
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalCounsellors = await User.countDocuments({ role: 'counsellor' });

    // Conversion rate
    const counselledCount = await Lead.countDocuments({ status: 'counselled' });
    const conversionRate = totalLeads > 0 ? Math.round((counselledCount / totalLeads) * 100) + '%' : '0%';

    // Status breakdown
    const leadsByStatus = {
      new: await Lead.countDocuments({ status: 'new' }),
      contacted: await Lead.countDocuments({ status: 'contacted' }),
      in_progress: await Lead.countDocuments({ status: 'in_progress' }),
      counselled: counselledCount,
      closed: await Lead.countDocuments({ status: 'closed' }),
      dropped: await Lead.countDocuments({ status: 'dropped' }),
    };

    // Popular branches
    const topBranches = await Lead.aggregate([
      { $group: { _id: '$preferredBranch', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Popular states
    const topStates = await Lead.aggregate([
      { $group: { _id: '$preferredState', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Registrations over last 7 days
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 7);
    const registrationsByDay = await User.aggregate([
      { $match: { createdAt: { $gte: dateLimit } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Lead assignment workload
    const counsellorsWorkload = await User.aggregate([
      { $match: { role: 'counsellor' } },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'leads',
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          openLeads: {
            $size: {
              $filter: {
                input: '$leads',
                as: 'lead',
                cond: { $in: ['$$lead.status', ['new', 'contacted', 'in_progress']] },
              },
            },
          },
          totalLeads: { $size: '$leads' },
        },
      },
      { $sort: { openLeads: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalLeads,
        totalUsers,
        activeUsers,
        totalCounsellors,
        conversionRate,
        leadsByStatus,
        topBranches: topBranches.map((b) => ({ branch: b._id, count: b.count })),
        topStates: topStates.map((s) => ({ state: s._id, count: s.count })),
        registrationsByDay,
        counsellorsWorkload,
      },
    });
  } catch (err) {
    console.error('Fetch admin stats error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /counsellors — List of counsellors (for assignments dropdowns)
router.get('/counsellors', async (req, res) => {
  try {
    const counsellors = await User.find({ role: { $in: ['counsellor', 'admin'] }, isActive: true }).select('name email');
    res.json({ success: true, data: counsellors });
  } catch (err) {
    console.error('Fetch counsellors list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
