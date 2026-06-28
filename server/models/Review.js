const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'College ID is required'],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, 'Overall rating is required'],
      min: 1,
      max: 5,
    },
    ratings: {
      academics: {
        type: Number,
        required: [true, 'Academics rating is required'],
        min: 1,
        max: 5,
      },
      placements: {
        type: Number,
        required: [true, 'Placements rating is required'],
        min: 1,
        max: 5,
      },
      infrastructure: {
        type: Number,
        required: [true, 'Infrastructure rating is required'],
        min: 1,
        max: 5,
      },
      socialLife: {
        type: Number,
        required: [true, 'Social life rating is required'],
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure a student can only leave one review per college
ReviewSchema.index({ collegeId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);
