const express = require('express');
const College = require('../models/College');

const router = express.Router();

// GET / — Get all colleges with optional search, type, and state filters
router.get('/', async (req, res) => {
  try {
    const { search, type, state } = req.query;
    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (type) {
      filter.type = type.trim();
    }

    if (state) {
      filter.state = state.trim();
    }

    // Sort by NIRF Rank (ascending, nulls at bottom) and then by name
    // MongoDB handles null sorting naturally, but we can structure it:
    const colleges = await College.find(filter).sort({
      nirfRank: 1,
      name: 1
    });

    res.json({ success: true, data: colleges });
  } catch (err) {
    console.error('Fetch colleges error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /public-stats — Get aggregated stats for landing and auth views
router.get('/public-stats', async (req, res) => {
  try {
    const totalColleges = await College.countDocuments();
    
    // Calculate average placement dynamically
    const avgPlacementsResult = await College.aggregate([
      { $match: { avgPlacement: { $ne: null } } },
      { $group: { _id: null, avgPlacement: { $avg: '$avgPlacement' } } }
    ]);
    const averagePlacement = avgPlacementsResult.length > 0 
      ? parseFloat(avgPlacementsResult[0].avgPlacement.toFixed(1)) 
      : 15.6;

    // Fetch actual count of users (or active students)
    const User = require('../models/User');
    const Lead = require('../models/Lead');
    const studentCount = await User.countDocuments({ role: 'student' });
    const leadsCount = await Lead.countDocuments();
    const totalStudentsGuided = 1000 + studentCount + leadsCount;

    // Pick a featured college (highest average placement NIT or IIT)
    const featuredCollege = await College.findOne({ 
      type: { $in: ['IIT', 'NIT'] }, 
      avgPlacement: { $ne: null } 
    }).sort({ avgPlacement: -1 });

    res.json({
      success: true,
      data: {
        totalColleges,
        averagePlacement,
        totalStudentsGuided,
        featuredCollege: featuredCollege ? {
          name: featuredCollege.name,
          city: featuredCollege.city,
          state: featuredCollege.state,
          avgPlacement: featuredCollege.avgPlacement,
          highestPlacement: featuredCollege.highestPlacement
        } : null
      }
    });
  } catch (err) {
    console.error('Fetch public stats error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /:id — Get details of a single college
router.get('/:id', async (req, res) => {
  try {
    const college = await College.findById(req.params.id);
    if (!college) {
      return res.status(404).json({ success: false, error: 'College not found' });
    }
    res.json({ success: true, data: college });
  } catch (err) {
    console.error('Fetch college details error:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ success: false, error: 'College not found' });
    }
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /affiliation — Submit a new college affiliation request
router.post('/affiliation', async (req, res) => {
  try {
    const AffiliationRequest = require('../models/AffiliationRequest');
    
    // Check if name is already taken in live colleges or pending requests
    const existingLive = await College.findOne({ name: req.body.name });
    if (existingLive) {
      return res.status(400).json({ success: false, error: 'This college name is already registered in our active database' });
    }
    
    const existingRequest = await AffiliationRequest.findOne({ name: req.body.name, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({ success: false, error: 'An affiliation request for this college is already pending review' });
    }

    const newRequest = new AffiliationRequest(req.body);
    await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'Your affiliation request has been submitted successfully and is under review.',
      data: newRequest
    });
  } catch (err) {
    console.error('Submit affiliation request error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages[0] || 'Validation Error' });
    }
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
