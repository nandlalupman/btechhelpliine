const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'College name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: [true, 'College type is required'],
      enum: ['IIT', 'NIT', 'IIIT', 'BITS', 'VIT', 'State', 'Private', 'Other'],
      default: 'Other',
    },
    nirfRank: {
      type: Number,
      default: null,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    admissionMode: {
      type: String,
      required: [true, 'Admission mode is required'],
      trim: true,
    },
    feesPerYear: {
      type: Number,
      required: [true, 'Fees per year is required'],
    },
    cutoffRankCSE: {
      type: String,
      required: [true, 'Cutoff rank for CSE is required'],
      trim: true,
    },
    avgPlacement: {
      type: Number,
      required: [true, 'Average placement package is required'],
    },
    highestPlacement: {
      type: Number,
      required: [true, 'Highest placement package is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    branches: {
      type: [String],
      default: ['Computer Science Engineering', 'Electronics & Communication Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering'],
    },
    imageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    website: {
      type: String,
      trim: true,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
      index: true,
    },
    aicteApproved: {
      type: Boolean,
      default: false,
    },
    ugcRecognized: {
      type: Boolean,
      default: true,
    },
    naacRating: {
      type: String,
      default: null,
      trim: true,
    },
    nbaAccredited: {
      type: Boolean,
      default: false,
    },
    nbaBranches: {
      type: [String],
      default: [],
    },
    bannerUrl: {
      type: String,
      default: null,
    },
    facilities: [
      {
        category: {
          type: String,
          enum: ['Classroom', 'Laboratory', 'Library', 'Hostel', 'Sports', 'Cafeteria', 'Other'],
          required: true,
        },
        imageUrl: { type: String, required: true },
        caption: { type: String, default: '' },
      }
    ],
    ratingAverage: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

CollegeSchema.pre('save', function (next) {
  if (this.nbaBranches && this.nbaBranches.length > 0) {
    this.nbaAccredited = true;
  } else {
    this.nbaAccredited = false;
  }
  next();
});

module.exports = mongoose.model('College', CollegeSchema);
