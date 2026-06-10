const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['student', 'counsellor', 'admin'],
      default: 'student',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    otpCode: String,
    otpExpires: Date,
    jeeRank: {
      type: String,
      default: '',
    },
    preferredBranch: {
      type: String,
      default: '',
    },
    preferredState: {
      type: String,
      default: '',
    },
    lastLogin: {
      type: Date,
    },
    preferredColleges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College'
      }
    ]
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', UserSchema);
