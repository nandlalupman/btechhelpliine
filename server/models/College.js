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
    website: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('College', CollegeSchema);
