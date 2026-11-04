const mongoose = require('mongoose');
module.exports = mongoose.model('StudentStory', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  displayName: { type: String, required: true, maxlength: 60 },
  message: { type: String, required: true, minlength: 20, maxlength: 700 },
  consent: { type: Boolean, required: true },
  status: { type: String, enum: ['pending', 'published', 'hidden'], default: 'pending' },
  revision: { type: Number, default: 1 },
  moderationNote: { type: String, default: '', maxlength: 400 }
}, { timestamps: true }));
