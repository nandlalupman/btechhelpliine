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

module.exports = router;
