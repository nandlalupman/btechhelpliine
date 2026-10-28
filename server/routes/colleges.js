const { collegeDescription, placementData, positiveNumber } = require('../utils/collegeData');
const express = require('express');
const College = require('../models/College');

const router = express.Router();

// GET / — Get all colleges with optional search, type, state, and affiliation filters
router.get('/', async (req, res) => {
  try {
    const { search, type, state, affiliation } = req.query;
    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, char => `\\${char}`), $options: 'i' };
    }

    if (type) {
      filter.type = type.trim();
    }

    if (state) {
      filter.state = state.trim();
    }

    if (affiliation) {
      const aff = affiliation.trim().toLowerCase();
      if (aff === 'partner') {
        filter.isOnboarded = true;
      } else if (aff === 'listed') {
        filter.isOnboarded = { $ne: true };
      }
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
    const partnerColleges = await College.countDocuments({ isOnboarded: true });
    
    // Calculate average placement dynamically
    const avgPlacementsResult = await College.aggregate([
      { $match: { avgPlacement: { $ne: null }, dataStatus: 'verified' } },
      { $group: { _id: null, avgPlacement: { $avg: '$avgPlacement' } } }
    ]);
    const averagePlacement = avgPlacementsResult.length > 0 
      ? parseFloat(avgPlacementsResult[0].avgPlacement.toFixed(1)) 
      : null;

    // Fetch actual count of users (or active students)
    const Lead = require('../models/Lead');
    const completed = await Lead.aggregate([
      { $match: { $or: [{ status: 'counselled' }, { counselledAt: { $ne: null } }] } },
      { $group: { _id: '$phone' } },
      { $count: 'total' }
    ]);
    const totalStudentsGuided = completed[0]?.total || 0;

    // Calculate unique cities covered
    const citiesResult = await College.distinct('city');
    const totalCities = citiesResult.length;

    // Pick a featured college (highest average placement NIT or IIT)
    const featuredCollege = await College.findOne({ 
      type: { $in: ['IIT', 'NIT'] }, dataStatus: 'verified',
      avgPlacement: { $ne: null } 
    }).sort({ avgPlacement: -1 });

    res.json({
      success: true,
      data: {
        totalColleges,
        partnerColleges,
        averagePlacement,
        totalStudentsGuided,
        totalCities,
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

// POST /onboard — Onboard a new college/institution request (with Admin direct onboarding support)
router.post('/onboard', async (req, res) => {
  try {
    const AffiliationRequest = require('../models/AffiliationRequest');
    
    // Check if name is already taken in live colleges or pending requests
    const existingLive = await College.findOne({ name: req.body.name });
    if (existingLive) {
      return res.status(400).json({ success: false, error: 'This college name is already registered in our active database' });
    }
    
    // Sanitize optional fields to prevent validation issues with Mongoose Enums
    const requestData = { ...req.body };
    if (requestData.lifestyle) {
      requestData.lifestyle = { ...requestData.lifestyle };
      if (requestData.lifestyle.attendanceEnforcement === '') {
        delete requestData.lifestyle.attendanceEnforcement;
      }
      if (requestData.lifestyle.curfewPolicy === '') {
        delete requestData.lifestyle.curfewPolicy;
      }
      if (requestData.lifestyle.dressCode === '') {
        delete requestData.lifestyle.dressCode;
      }
    }
    if (requestData.naacRating === '') {
      delete requestData.naacRating;
    }
    if (requestData.ugcRecognized !== undefined) {
      requestData.ugcRecognized = requestData.ugcRecognized === true || requestData.ugcRecognized === 'true';
    }
    if (requestData.nbaAccredited !== undefined) {
      requestData.nbaAccredited = requestData.nbaAccredited === true || requestData.nbaAccredited === 'true';
    }
    if (requestData.nirfRank === '' || requestData.nirfRank === null || isNaN(requestData.nirfRank)) {
      delete requestData.nirfRank;
    }
    if (requestData.bannerUrl === '') {
      requestData.bannerUrl = null;
    }
    if (requestData.facilities && Array.isArray(requestData.facilities)) {
      requestData.facilities = requestData.facilities.filter(f => f && f.imageUrl && f.imageUrl.trim() !== '' && f.category);
    } else {
      requestData.facilities = [];
    }

    // Check if directOnboard is requested and caller is admin
    let isAdmin = false;
    if (req.body.directOnboard === true && req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const { getJwtSecret } = require('../config/jwt');
        const token = req.headers.authorization.split(' ')[1];
        if (token) {
          const secret = await getJwtSecret();
          const decoded = jwt.verify(token, secret);
          if (decoded && decoded.role === 'admin') {
            isAdmin = true;
          }
        }
      } catch (tokenErr) {
        console.log('Token verification failed for direct onboarding request:', tokenErr.message);
      }
    }

    if (isAdmin) {
      // Admin Direct Onboarding: create live college directly
      let collegeType = 'Other';
      if (requestData.governance === 'Government / Public') collegeType = 'State';
      else if (requestData.governance === 'Private University') collegeType = 'Private';
      else if (requestData.governance === 'Govt-Aided / Semi-Govt') collegeType = 'State';

      let cseCutoff = 'N/A';
      if (requestData.cutoffs && Array.isArray(requestData.cutoffs)) {
        const cseCutoffObj = requestData.cutoffs.find(c => c.streamName && c.streamName.includes('Computer Science'));
        if (cseCutoffObj) {
          cseCutoff = cseCutoffObj.jeeClosingRank ? `~${cseCutoffObj.jeeClosingRank} (JEE)` : (cseCutoffObj.stateClosingRank ? `~${cseCutoffObj.stateClosingRank} (State)` : 'N/A');
        }
      }

      const { avgPlacement, highestPlacement } = placementData(requestData);


      const description = collegeDescription(requestData);

      const branchesList = requestData.branches ? requestData.branches.map(b => b.branchName) : [];

      const college = new College({
        name: requestData.name,
        type: collegeType,
        nirfRank: requestData.nirfRank || null,
        city: requestData.city,
        state: requestData.state,
        admissionMode: (requestData.acceptedExams && requestData.acceptedExams.join(', ')) || 'Confirm with institution',
        feesPerYear: positiveNumber(requestData.fees?.tuitionGeneral),
        cutoffRankCSE: cseCutoff,
        avgPlacement: avgPlacement,
        highestPlacement: highestPlacement,
        description: description,
        branches: branchesList.length > 0 ? branchesList : undefined,
        website: requestData.website || undefined,
        imageUrl: requestData.bannerUrl || null,
        isOnboarded: true,
        aicteApproved: requestData.aicteApproved === true,
        ugcRecognized: requestData.ugcRecognized === true,
        naacRating: requestData.naacRating || null,
        nbaAccredited: !!(requestData.nbaAccredited || (requestData.branches && requestData.branches.some(b => b.nbaAccredited))),
        nbaBranches: requestData.nbaBranches || [],
        bannerUrl: requestData.bannerUrl || null,
        facilities: requestData.facilities || []
      });

      await college.save();

      return res.status(201).json({
        success: true,
        message: 'College has been successfully onboarded and published live in the active directory.',
        data: college
      });
    }

    // Otherwise standard partner onboarding request
    const existingRequest = await AffiliationRequest.findOne({ name: req.body.name, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({ success: false, error: 'An onboarding request for this college is already pending review' });
    }

    const newRequest = new AffiliationRequest(requestData);
    await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'Your onboarding request has been submitted successfully and is under review.',
      data: newRequest
    });
  } catch (err) {
    console.error('Submit onboarding request error:', err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages[0] || 'Validation Error' });
    }
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /:id/reviews — Fetch all reviews for a college
router.get('/:id/reviews', async (req, res) => {
  try {
    const Review = require('../models/Review');
    const reviews = await Review.find({ collegeId: req.params.id, moderationStatus: 'published' }).select('studentName rating ratings comment images createdAt').sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, data: reviews.map(review => ({ ...review, images: require('../utils/reviewImages').images(review.images) })) });
  } catch (err) {
    console.error('Fetch reviews error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /:id/reviews — Submit/Update a review for a college (Authenticated users only)
const { verifyToken } = require('../middleware/auth');
router.post('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const Review = require('../models/Review');
    const { rating, comment, ratings, images } = req.body;
    if (images && (!Array.isArray(images) || images.length > 3 || images.some(image => typeof image !== 'string' || image.length > 400000 || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)))) {
      return res.status(400).json({ success: false, error: 'Attach up to three compressed PNG, JPEG or WebP images, each below 300 KB.' });
    }

    if (typeof comment !== 'string' || comment.trim().length < 10 || comment.length > 4000 || ![rating, ...Object.values(ratings || {})].every(value => Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 5)) {
      return res.status(400).json({ success: false, error: 'Use ratings from 1 to 5 and a review of 10–4000 characters.' });
    }
    if (!await College.exists({ _id: req.params.id })) return res.status(404).json({ success: false, error: 'College not found' });

    if (!rating || !comment || !ratings) {
      return res.status(400).json({ success: false, error: 'Please provide rating, comment, and sectional ratings.' });
    }

    const { academics, placements, infrastructure, socialLife } = ratings;
    if (academics === undefined || placements === undefined || infrastructure === undefined || socialLife === undefined) {
      return res.status(400).json({ success: false, error: 'Please provide all sectional ratings.' });
    }

    const collegeId = req.params.id;
    const studentId = req.user.userId;
    
    // Fetch student profile to get their name
    const User = require('../models/User');
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student profile not found.' });
    }

    // Upsert the review
    const reviewData = {
      collegeId,
      studentId,
      studentName: student.name,
      rating: parseFloat(rating),
      ratings: {
        academics: parseFloat(academics),
        placements: parseFloat(placements),
        infrastructure: parseFloat(infrastructure),
        socialLife: parseFloat(socialLife)
      },
      comment,
      images: images || [],
      moderationStatus: 'pending',
      moderatedAt: null
    };

    const review = await Review.findOneAndUpdate(
      { collegeId, studentId },
      reviewData,
      { upsert: true, new: true, runValidators: true }
    );

    // Re-calculate average ratings for the college
    const allReviews = await Review.find({ collegeId, moderationStatus: 'published' });
    const count = allReviews.length;
    let sum = 0;
    allReviews.forEach(r => sum += r.rating);
    const average = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;

    // Update college record
    await College.findByIdAndUpdate(collegeId, {
      ratingAverage: average,
      ratingCount: count
    });

    res.status(201).json({
      success: true,
      message: 'Your review has been submitted for moderation.',
      data: review
    });
  } catch (err) {
    console.error('Submit review error:', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
