const mongoose = require('mongoose');
const application = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 160 },
  deadline: { type: Date, required: true },
  sourceUrl: { type: String, default: '', maxlength: 1000 },
  notes: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['planning', 'applied', 'allotted', 'reported', 'closed'], default: 'planning' },
  emailReminder: { type: Boolean, default: false },
  reminderSentAt: { type: Date, default: null },
  reminderClaimedAt: { type: Date, default: null }
}, { timestamps: true });
const slot = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startAt: { type: Date, required: true, index: true },
  label: { type: String, default: 'Counselling session', maxlength: 100 },
  durationMinutes: { type: Number, enum: [15, 30, 45, 60], default: 30 },
  booked: { type: Boolean, default: false },
  bookingRef: { type: String, default: null },
  cancelled: { type: Boolean, default: false }
}, { timestamps: true });
slot.index({ staffId: 1, startAt: 1 }, { unique: true });
const appointment = new mongoose.Schema({
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'CounsellingSlot', required: true },
  reference: { type: String, required: true, unique: true },
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, maxlength: 254 },
  phone: { type: String, required: true },
  question: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['booked', 'completed', 'cancelled'], default: 'booked' },
  contactConsent: { type: Boolean, required: true },
  consentAt: { type: Date, required: true },
  staffNotes: { type: String, default: '', maxlength: 2000 }
}, { timestamps: true });
module.exports = {
  Application: mongoose.model('Application', application),
  CounsellingSlot: mongoose.model('CounsellingSlot', slot),
  Appointment: mongoose.model('Appointment', appointment)
};
