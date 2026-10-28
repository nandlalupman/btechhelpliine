const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Message = require('../models/ConversationMessage');
const mail = require('../utils/email');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getJwtSecret } = require('../config/jwt');
const { hashKey, canHandle, owns, validKey, studentView } = require('../services/conversations');
const router = express.Router();
const run = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validate = (req, res, next) => { const errors = validationResult(req); return errors.isEmpty() ? next() : res.status(400).json({ success: false, error: errors.array()[0].msg }); };
router.param('id', (req, res, next, value) => mongoose.isValidObjectId(value) ? next() : res.status(400).json({ success: false, error: 'Invalid request reference' }));
const messageInput = [body('text').isString().trim().isLength({ min: 1, max: 4000 }).withMessage('Write a message of 1–4000 characters.'), validate];
const statuses = ['new', 'contacted', 'in_progress', 'counselled', 'closed', 'dropped', 'cancelled'];
router.get('/mine', verifyToken, run(async (req, res) => {
  const leads = await Lead.find({ userId: req.user.userId }).select('-notes').sort('-lastMessageAt').limit(100).lean();
  res.json({ success: true, data: leads.map(studentView) });
}));
router.post('/access', body('accessKey').matches(/^[a-f0-9]{64}$/).withMessage('Enter the 64-character private tracking code.'), validate, run(async (req, res) => {
  const lead = await Lead.findOne({ trackingTokenHash: hashKey(req.body.accessKey) }).select('_id subject');
  if (!lead) return res.status(404).json({ success: false, error: 'Request not found. Check your private tracking code.' });
  res.json({ success: true, data: { _id: lead._id, subject: lead.subject } });
}));
async function studentAccess(req, res, next) {
  const lead = await Lead.findById(req.params.id).select('+trackingTokenHash');
  if (!lead) return res.status(404).json({ success: false, error: 'Request not found' });
  let user;
  const bearer = req.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    try { const decoded = jwt.verify(bearer.slice(7), await getJwtSecret()); const account = await User.findById(decoded.userId); if (account?.isActive) user = { userId: account._id, role: account.role }; } catch {}
  }
  if (!owns(lead, user) && !validKey(lead, req.body.accessKey)) return res.status(403).json({ success: false, error: 'Use the account that sent this request or its private tracking code.' });
  req.lead = lead; req.sender = user; next();
}
router.post('/thread/:id', run(studentAccess), run(async (req, res) => {
  const before = req.body.before;
  if (before && !mongoose.isValidObjectId(before)) return res.status(400).json({ success: false, error: 'Invalid message cursor' });
  const messages = await Message.find({ leadId: req.lead._id, ...(before ? { _id: { $lt: before } } : {}) }).select('senderType kind body delivery createdAt').sort('-_id').limit(51).lean();
  const more = messages.length > 50; const batch = messages.slice(0, 50).reverse();
  if (!before) { req.lead.studentReadAt = new Date(); await Lead.updateOne({ _id: req.lead._id }, { $set: { studentReadAt: req.lead.studentReadAt } }); }
  res.json({ success: true, data: { request: studentView(req.lead), messages: batch, nextCursor: more ? String(batch[0]._id) : null } });
}));
router.post('/thread/:id/reply', ...messageInput, run(studentAccess), run(async (req, res) => {
  if (['closed', 'cancelled', 'dropped'].includes(req.lead.status)) return res.status(409).json({ success: false, error: 'This request is closed. Please send a new request.' });
  const message = await Message.create({ leadId: req.lead._id, senderType: 'student', senderId: req.sender?.userId || null, body: req.body.text });
  await Lead.updateOne({ _id: req.lead._id }, { $set: { lastMessageFrom: 'student', lastMessageAt: message.createdAt } });
  res.status(201).json({ success: true, data: { _id: message._id } });
}));
router.use('/staff', verifyToken, requireRole('admin', 'counsellor'));
const staffScope = req => req.user.role === 'admin' ? {} : { assignedTo: req.user.userId };
router.get('/staff', run(async (req, res) => {
  const query = { ...staffScope(req) };
  if (req.query.status && statuses.includes(req.query.status)) query.status = req.query.status;
  if (req.query.waiting === '1') { query.lastMessageFrom = 'student'; query.$and = [{ status: { $nin: ['closed', 'dropped', 'cancelled'] } }]; }
  if (req.query.followUp === '1') { query.followUpAt = { $lte: new Date() }; query.$and = [...(query.$and || []), { status: { $nin: ['closed', 'dropped', 'cancelled', 'counselled'] } }]; }
  if (req.user.role === 'admin' && req.query.unassigned === '1') query.assignedTo = null;
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const pattern = req.query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['name', 'email', 'phone', 'subject'].map(field => ({ [field]: new RegExp(pattern, 'i') }));
  }
  const page = Math.max(0, Math.min(10000, parseInt(req.query.page, 10) || 0));
  const [leads, total, waiting, followUp, staff] = await Promise.all([
    Lead.find(query).select('name email subject status priority assignedTo followUpAt lastMessageAt lastMessageFrom staffReadAt createdAt').populate('assignedTo', 'name').sort('-lastMessageAt -_id').skip(page * 25).limit(25).lean(),
    Lead.countDocuments(query),
    Lead.countDocuments({ ...staffScope(req), lastMessageFrom: 'student', status: { $nin: ['closed', 'dropped', 'cancelled'] } }),
    Lead.countDocuments({ ...staffScope(req), followUpAt: { $lte: new Date() }, status: { $nin: ['closed', 'dropped', 'cancelled', 'counselled'] } }),
    req.user.role === 'admin' ? User.find({ role: { $in: ['admin', 'counsellor'] }, isActive: true }).select('name role').lean() : []
  ]);
  res.json({ success: true, data: { leads, total, page, waiting, followUp, staff, role: req.user.role } });
}));
async function staffAccess(req, res, next) {
  const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name role').populate('notes.addedBy', 'name');
  if (!lead) return res.status(404).json({ success: false, error: 'Request not found' });
  if (!canHandle(lead, req.user)) return res.status(403).json({ success: false, error: 'Only the assigned counsellor or an administrator can handle this request.' });
  req.lead = lead; next();
}
router.get('/staff/:id', run(staffAccess), run(async (req, res) => {
  const before = req.query.before;
  if (before && !mongoose.isValidObjectId(before)) return res.status(400).json({ success: false, error: 'Invalid message cursor' });
  const messages = await Message.find({ leadId: req.lead._id, ...(before ? { _id: { $lt: before } } : {}) }).select('senderType kind body delivery createdAt').sort('-_id').limit(51).lean();
  const more = messages.length > 50, batch = messages.slice(0, 50).reverse();
  if (!before) await Lead.updateOne({ _id: req.lead._id }, { $set: { staffReadAt: new Date() } });
  res.json({ success: true, data: { request: req.lead, messages: batch, nextCursor: more ? String(batch[0]._id) : null } });
}));
router.post('/staff/:id/reply', ...messageInput, body('notify').optional().isBoolean({ strict: true }), validate, run(staffAccess), run(async (req, res) => {
  if (['closed', 'cancelled', 'dropped'].includes(req.lead.status)) return res.status(409).json({ success: false, error: 'Reopen the request before replying.' });
  const message = await Message.create({ leadId: req.lead._id, senderId: req.user.userId, senderType: 'team', body: req.body.text });
  await Lead.updateOne({ _id: req.lead._id }, { $set: { lastMessageFrom: 'team', lastMessageAt: message.createdAt, status: req.lead.status === 'new' ? 'contacted' : req.lead.status } });
  if (req.body.notify === true && req.lead.contactConsent === true) {
    try { await mail.sendCustomEmail(req.lead.email, 'BtechHelpline replied to your request', `Request: ${req.lead.subject || 'Admission counselling'}\n\n${req.body.text}\n\nView your conversation at ${(process.env.FRONTEND_URL || 'https://www.btechhelpline.com')}/messages/ using your account or private tracking code. Never share that code.`); message.delivery = mail.deliveryMode; } catch { message.delivery = 'failed'; }
    await message.save();
  }
  res.status(201).json({ success: true, data: { _id: message._id, delivery: message.delivery }, message: 'Reply saved in the conversation.' });
}));
router.patch('/staff/:id',
  body('status').optional().isIn(statuses), body('priority').optional().isIn(['low', 'medium', 'high']),
  body('followUpAt').optional({ nullable: true }).isISO8601(),
  body('assignedTo').optional({ nullable: true }).isMongoId(), validate, run(staffAccess), run(async (req, res) => {
    const fields = {}, events = [];
    for (const field of ['status', 'priority', 'followUpAt']) if (Object.hasOwn(req.body, field)) fields[field] = req.body[field];
    if (Object.hasOwn(req.body, 'assignedTo')) {
      if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Only an administrator can change assignment.' });
      if (req.body.assignedTo && !await User.exists({ _id: req.body.assignedTo, isActive: true, role: { $in: ['admin', 'counsellor'] } })) return res.status(400).json({ success: false, error: 'Choose an active team member.' });
      fields.assignedTo = req.body.assignedTo || null;
    }
    if (fields.status && fields.status !== req.lead.status) events.push(`Request status changed to ${fields.status.replace(/_/g, ' ')}.`);
    if (fields.status === 'counselled' && !req.lead.counselledAt) fields.counselledAt = new Date();
    await Lead.updateOne({ _id: req.lead._id }, { $set: fields }, { runValidators: true });
    if (events.length) await Message.create({ leadId: req.lead._id, senderId: req.user.userId, senderType: 'team', kind: 'event', body: events.join(' ') });
    res.json({ success: true });
  })
);
router.post('/staff/:id/notes', ...messageInput, run(staffAccess), run(async (req, res) => {
  await Lead.updateOne({ _id: req.lead._id }, { $push: { notes: { $each: [{ text: req.body.text, addedBy: req.user.userId }], $slice: -100 } } });
  res.status(201).json({ success: true });
}));
module.exports = router;
