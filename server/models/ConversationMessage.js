const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderType: { type: String, enum: ['student', 'team'], required: true },
  kind: { type: String, enum: ['message', 'event'], default: 'message' },
  body: { type: String, required: true, maxlength: 4000 },
  delivery: { type: String, enum: ['not-requested', 'local-preview', 'smtp', 'failed'], default: 'not-requested' }
}, { timestamps: true });
schema.index({ leadId: 1, _id: -1 });
module.exports = mongoose.model('ConversationMessage', schema);
