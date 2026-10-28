const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 4000,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const LeadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    jeeRank: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'General',
    },
    preferredBranch: {
      type: String,
      required: [true, 'Preferred branch is required'],
    },
    preferredState: {
      type: String,
      required: [true, 'Preferred state is required'],
    },
    budget: {
      type: String,
      default: 'Not Specified',
    },
    message: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    subject: { type: String, default: 'Admission counselling', maxlength: 160 },
    trackingTokenHash: { type: String, select: false, index: { unique: true, sparse: true } },
    lastMessageFrom: { type: String, enum: ['student', 'team'], default: 'student' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    studentReadAt: { type: Date, default: null },
    staffReadAt: { type: Date, default: null },
    followUpAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ['new', 'contacted', 'in_progress', 'counselled', 'closed', 'dropped', 'cancelled'],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: [NoteSchema],
    source: {
      type: String,
      default: 'website_form',
    },
    exam: { type: String, default: '' },
    homeState: { type: String, default: '' },
    contactConsent: { type: Boolean, default: false },
    partnerConsent: { type: Boolean, default: false },
    consentAt: { type: Date, default: null },
    preferredContactTime: { type: String, default: '' },
    counselledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Lead', LeadSchema);
