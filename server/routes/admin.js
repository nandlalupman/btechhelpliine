const express = require('express');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const User = require('../models/User');
const College = require('../models/College');
const { verifyToken, requireRole } = require('../middleware/auth');


const router = express.Router();

// Apply auth + admin check to all admin routes
router.use(verifyToken);
router.use(requireRole('admin'));

// Helper to validate base64 image strings
function isValidBase64Image(str) {
  if (!str) return true;
  const regex = /^data:image\/(jpeg|png|webp|gif);base64,/;
  if (!regex.test(str)) return false;
  const base64Part = str.split(',')[1];
  if (!base64Part) return false;
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Regex.test(base64Part);
}

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
    const user = await User.findById(req.params.id).select('-password').populate('preferredColleges');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Admin fetch user detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /users/:id — Update any user details (Admin only)
router.put(
  '/users/:id',
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
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

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
        message: 'User profile updated successfully',
        data: user,
      });
    } catch (err) {
      console.error('Admin update user details error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// DELETE /users/:id — Delete any user (student, counsellor, etc.)
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent self deletion
    if (req.params.id.toString() === req.user.userId.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own admin account' });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete associated leads for clean-up
    await Lead.deleteMany({ userId: req.params.id });

    res.json({ success: true, message: 'User and all associated leads deleted successfully' });
  } catch (err) {
    console.error('Admin delete user error:', err.message);
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
    const pendingLeads = await Lead.countDocuments({ status: 'new' });
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalCounsellors = await User.countDocuments({ role: 'counsellor' });
    const totalColleges = await College.countDocuments();

    // Average and Max placement packages in the system
    const avgPlacementsResult = await College.aggregate([
      { $match: { avgPlacement: { $ne: null } } },
      { $group: { _id: null, avgPlacement: { $avg: '$avgPlacement' } } }
    ]);
    const avgPlacement = avgPlacementsResult.length > 0 ? parseFloat(avgPlacementsResult[0].avgPlacement.toFixed(1)) : 0;

    const maxPlacementResult = await College.aggregate([
      { $match: { highestPlacement: { $ne: null } } },
      { $group: { _id: null, maxPlacement: { $max: '$highestPlacement' } } }
    ]);
    const maxPlacement = maxPlacementResult.length > 0 ? parseFloat(maxPlacementResult[0].maxPlacement.toFixed(1)) : 0;

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
        pendingLeads,
        totalUsers,
        activeUsers,
        totalCounsellors,
        totalColleges,
        avgPlacement,
        maxPlacement,
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

// POST /colleges — Add a new college (Admin only)
router.post(
  '/colleges',
  [
    body('name').trim().notEmpty().withMessage('College name is required'),
    body('type').isIn(['IIT', 'NIT', 'IIIT', 'BITS', 'VIT', 'State', 'Private', 'Other']).withMessage('Invalid college type'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('admissionMode').trim().notEmpty().withMessage('Admission mode is required'),
    body('feesPerYear').isNumeric().withMessage('Fees per year must be a number'),
    body('cutoffRankCSE').trim().notEmpty().withMessage('Cutoff rank is required'),
    body('avgPlacement').isNumeric().withMessage('Average placement must be a number'),
    body('highestPlacement').isNumeric().withMessage('Highest placement must be a number'),
    body('description').trim().notEmpty().withMessage('Description is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const {
      name,
      type,
      nirfRank,
      city,
      state,
      admissionMode,
      feesPerYear,
      cutoffRankCSE,
      avgPlacement,
      highestPlacement,
      description,
      branches,
      website,
      imageUrl,
      bannerUrl,
      facilities,
      aicteApproved,
      ugcRecognized,
      naacRating,
      nbaAccredited,
      nbaBranches
    } = req.body;

    try {
      // Check if already exists
      const existing = await College.findOne({ name });
      if (existing) {
        return res.status(400).json({ success: false, error: 'A college with this name is already registered' });
      }

      if (bannerUrl && !isValidBase64Image(bannerUrl)) {
        return res.status(400).json({ success: false, error: 'Invalid banner image format' });
      }
      if (facilities && Array.isArray(facilities)) {
        for (const fac of facilities) {
          if (fac.imageUrl && !isValidBase64Image(fac.imageUrl)) {
            return res.status(400).json({ success: false, error: 'Invalid facility image format' });
          }
        }
      }

      const college = new College({
        name,
        type,
        nirfRank: nirfRank || null,
        city,
        state,
        admissionMode,
        feesPerYear,
        cutoffRankCSE,
        avgPlacement,
        highestPlacement,
        description,
        branches: branches || [],
        website,
        imageUrl,
        bannerUrl: bannerUrl || null,
        facilities: facilities || [],
        aicteApproved: aicteApproved === true,
        ugcRecognized: ugcRecognized !== false,
        naacRating: naacRating || null,
        nbaAccredited: nbaAccredited === true,
        nbaBranches: nbaBranches || []
      });

      await college.save();
      res.status(201).json({ success: true, message: 'College added successfully', data: college });
    } catch (err) {
      console.error('Admin add college error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// PUT /colleges/:id — Update a college (Admin only)
router.put(
  '/colleges/:id',
  async (req, res) => {
    try {
      const college = await College.findById(req.params.id);
      if (!college) {
        return res.status(404).json({ success: false, error: 'College not found' });
      }

      // Check if name is being changed and is already taken
      if (req.body.name && req.body.name !== college.name) {
        const existing = await College.findOne({ name: req.body.name });
        if (existing) {
          return res.status(400).json({ success: false, error: 'A college with this name is already registered' });
        }
      }

      if (req.body.bannerUrl && !isValidBase64Image(req.body.bannerUrl)) {
        return res.status(400).json({ success: false, error: 'Invalid banner image format' });
      }
      if (req.body.facilities && Array.isArray(req.body.facilities)) {
        for (const fac of req.body.facilities) {
          if (fac.imageUrl && !isValidBase64Image(fac.imageUrl)) {
            return res.status(400).json({ success: false, error: 'Invalid facility image format' });
          }
        }
      }

      const updated = await College.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );

      res.json({ success: true, message: 'College updated successfully', data: updated });
    } catch (err) {
      console.error('Admin update college error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// DELETE /colleges/:id — Delete a college (Admin only)
router.delete(
  '/colleges/:id',
  async (req, res) => {
    try {
      const college = await College.findByIdAndDelete(req.params.id);
      if (!college) {
        return res.status(404).json({ success: false, error: 'College not found' });
      }
      res.json({ success: true, message: 'College deleted successfully' });
    } catch (err) {
      console.error('Admin delete college error:', err.message);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
);

// GET /onboard-requests — Fetch all onboarding requests (Admin only)
router.get('/onboard-requests', async (req, res) => {
  try {
    const AffiliationRequest = require('../models/AffiliationRequest');
    const { status } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }
    const requests = await AffiliationRequest.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Admin fetch onboarding requests error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /onboard-requests/:id — Fetch single request details (Admin only)
router.get('/onboard-requests/:id', async (req, res) => {
  try {
    const AffiliationRequest = require('../models/AffiliationRequest');
    const request = await AffiliationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    res.json({ success: true, data: request });
  } catch (err) {
    console.error('Admin fetch onboarding request detail error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /onboard-requests/:id/status — Update status & auto-import college if approved (Admin only)
router.put('/onboard-requests/:id/status', async (req, res) => {
  try {
    const AffiliationRequest = require('../models/AffiliationRequest');
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const request = await AffiliationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // If status is being updated to approved
    if (status === 'approved' && request.status !== 'approved') {
      const College = require('../models/College');
      
      // Check if college name already exists
      const existing = await College.findOne({ name: request.name });
      if (existing) {
        return res.status(400).json({ success: false, error: 'A college with this name is already registered in the database' });
      }

      // Map governance to college type
      let collegeType = 'Other';
      if (request.governance === 'Government / Public') collegeType = 'State';
      else if (request.governance === 'Private University') collegeType = 'Private';
      else if (request.governance === 'Govt-Aided / Semi-Govt') collegeType = 'State';

      // Determine CSE cutoff rank
      let cseCutoff = 'N/A';
      const cseCutoffObj = request.cutoffs.find(c => c.streamName.includes('Computer Science'));
      if (cseCutoffObj) {
        cseCutoff = cseCutoffObj.jeeClosingRank ? `~${cseCutoffObj.jeeClosingRank} (JEE)` : (cseCutoffObj.stateClosingRank ? `~${cseCutoffObj.stateClosingRank} (State)` : 'N/A');
      }

      // Determine avg and highest placement
      let avgPlacement = 5.0;
      let highestPlacement = 10.0;
      const techPlacement = request.placements.find(p => p.poolName.includes('Tech'));
      if (techPlacement) {
        avgPlacement = techPlacement.averageCTC || techPlacement.medianCTC || 5.0;
        highestPlacement = techPlacement.highestCTC || 10.0;
      }

      // Synthesize a descriptive narrative
      const description = `Established in ${request.establishmentYear}, ${request.name} is a premier ${request.autonomyStatus.toLowerCase()} college situated in ${request.city}, ${request.state}. Onboarded with BtechHelpline and approved by AICTE, it offers excellent B.Tech degrees with a strong faculty-to-student ratio of 1:${request.facultyToStudentRatio || 15} and ${request.phdFacultyPercent || 30}% PhD faculty. The campus lifestyle maintains a ${request.lifestyle.curfewPolicy ? request.lifestyle.curfewPolicy.toLowerCase() : 'moderate curfew'} curfew structure and features ${request.lifestyle.totalCodingClubs || 3} active tech and coding clubs.`;

      // Branches list
      const branchesList = request.branches.map(b => b.branchName);

      // Create live college entry
      const college = new College({
        name: request.name,
        type: collegeType,
        nirfRank: request.nirfRank || null,
        city: request.city,
        state: request.state,
        admissionMode: request.acceptedExams.join(', ') || 'JEE Main',
        feesPerYear: request.fees.tuitionGeneral,
        cutoffRankCSE: cseCutoff,
        avgPlacement: avgPlacement,
        highestPlacement: highestPlacement,
        description: description,
        branches: branchesList.length > 0 ? branchesList : undefined,
        website: request.website || undefined,
        imageUrl: null,
        isOnboarded: true,
        aicteApproved: request.aicteApproved !== false,
        ugcRecognized: request.ugcRecognized !== false,
        naacRating: request.naacRating || null,
        nbaAccredited: !!(request.nbaAccredited || (request.branches && request.branches.some(b => b.nbaAccredited))),
        nbaBranches: request.nbaBranches || [],
        bannerUrl: request.bannerUrl || null,
        facilities: request.facilities || []
      });

      await college.save();
    }

    request.status = status;
    await request.save();

    res.json({ 
      success: true, 
      message: `Request successfully ${status}.`,
      data: request 
    });
  } catch (err) {
    console.error('Admin update onboarding status error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// DELETE /onboard-requests/:id — Delete onboarding request (Admin only)
router.delete('/onboard-requests/:id', async (req, res) => {
  try {
    const AffiliationRequest = require('../models/AffiliationRequest');
    const request = await AffiliationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Only allow deletion of approved or rejected requests (following user requirements)
    if (request.status === 'pending') {
      return res.status(400).json({ success: false, error: 'Cannot delete a pending request. Please approve or reject it first.' });
    }

    // If the request was approved, delete the associated college from the directory
    if (request.status === 'approved') {
      const College = require('../models/College');
      await College.findOneAndDelete({ name: request.name });
    }

    await AffiliationRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Onboarding request deleted successfully' });
  } catch (err) {
    console.error('Admin delete onboarding request error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;

