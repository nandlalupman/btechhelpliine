const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const { Application, CounsellingSlot, Appointment } = require('../models/Journey');
const Review = require('../models/Review');
const College = require('../models/College');
const mail = require('../utils/email');
const { safeUrl } = require('../services/catalogue');
const { sendDueReminders } = require('../services/reminders');
const router = express.Router();
const run = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validate = (req, res, next) => { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg }); next(); };
const id = (req, res, next) => mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ success: false, error: 'Invalid record identifier' });
router.get('/slots', run(async (req, res) => {
  const slots = await CounsellingSlot.find({ booked: false, cancelled: false, startAt: { $gt: new Date() } }).select('startAt durationMinutes label').sort('startAt').limit(100).lean();
  res.json({ success: true, data: slots, localPreview: process.env.LOCAL_PREVIEW === '1' });
}));
router.post('/appointments/:id([a-fA-F0-9]{24})', id,
  body('name').isString().trim().isLength({ min: 1, max: 100 }), body('email').isEmail().isLength({ max: 254 }),
  body('phone').matches(/^[6-9]\d{9}$/), body('question').optional().isString().isLength({ max: 2000 }),
  body('contactConsent').custom(value => value === true).withMessage('Please agree to contact about this appointment.'), validate,
  run(async (req, res) => {
    const reference = crypto.randomBytes(18).toString('hex');
    const slot = await CounsellingSlot.findOneAndUpdate({ _id: req.params.id, booked: false, cancelled: false, startAt: { $gt: new Date() } }, { $set: { booked: true, bookingRef: reference } }, { new: true });
    if (!slot) return res.status(409).json({ success: false, error: 'That slot is no longer available. Please choose another.' });
    try {
      const appointment = await Appointment.create({ slotId: slot._id, reference, name: req.body.name, email: req.body.email.trim().toLowerCase(), phone: req.body.phone, question: req.body.question || '', contactConsent: true, consentAt: new Date() });
      let notification = mail.deliveryMode;
      try { await mail.sendCustomEmail(appointment.email, 'Your counselling appointment', `Your counselling slot is booked for ${slot.startAt.toISOString()} (${slot.durationMinutes} minutes).\nReference: ${reference}\nManage it at ${(process.env.FRONTEND_URL || 'https://www.btechhelpline.com')}/appointments/\n\n${process.env.LOCAL_PREVIEW === '1' ? 'Local preview booking: this is a development session, not live team availability.' : 'The team will contact you using the details you provided.'}`); } catch { notification = 'failed'; }
      res.status(201).json({ success: true, data: { reference, startAt: slot.startAt, durationMinutes: slot.durationMinutes, status: appointment.status }, notification, localPreview: process.env.LOCAL_PREVIEW === '1' });
    } catch (error) {
      await CounsellingSlot.updateOne({ _id: slot._id, bookingRef: reference }, { $set: { booked: false, bookingRef: null } });
      throw error;
    }
  })
);
router.post('/appointments/manage', body('reference').matches(/^[a-f0-9]{36}$/), validate, run(async (req, res) => {
  const appointment = await Appointment.findOne({ reference: req.body.reference }).populate('slotId', 'startAt durationMinutes label');
  if (!appointment) return res.status(404).json({ success: false, error: 'Booking not found. Check your reference.' });
  if (req.body.cancel === true && appointment.status === 'booked') {
    appointment.status = 'cancelled'; await appointment.save();
    await CounsellingSlot.updateOne({ _id: appointment.slotId._id, bookingRef: appointment.reference }, { $set: { booked: false, bookingRef: null } });
  }
  res.json({ success: true, data: { reference: appointment.reference, status: appointment.status, slot: appointment.slotId } });
}));
router.get('/applications', verifyToken, run(async (req, res) => res.json({ success: true, data: await Application.find({ userId: req.user.userId }).sort('deadline') })));
const applicationValidation = [body('title').isString().trim().isLength({ min: 1, max: 160 }), body('deadline').isISO8601().withMessage('Enter a valid deadline'), body('sourceUrl').optional({ checkFalsy: true }).isURL({ protocols: ['https', 'http'], require_protocol: true }), body('notes').optional().isString().isLength({ max: 2000 }), body('emailReminder').optional().isBoolean({ strict: true }), body('status').optional().isIn(['planning', 'applied', 'allotted', 'reported', 'closed']), validate];
const applicationFields = req => ({ title: req.body.title, deadline: new Date(req.body.deadline), sourceUrl: safeUrl(req.body.sourceUrl), notes: req.body.notes || '', status: req.body.status || 'planning', emailReminder: req.body.emailReminder === true });
router.post('/applications', verifyToken, ...applicationValidation, run(async (req, res) => {
  const record = await Application.create({ ...applicationFields(req), userId: req.user.userId }); res.status(201).json({ success: true, data: record });
}));
router.put('/applications/:id', verifyToken, id, ...applicationValidation, run(async (req, res) => {
  const record = await Application.findOne({ _id: req.params.id, userId: req.user.userId });
  if (!record) return res.status(404).json({ success: false, error: 'Application not found' });
  const fields = applicationFields(req);
  if (+record.deadline !== +fields.deadline) { record.reminderSentAt = null; record.reminderClaimedAt = null; }
  record.set(fields); await record.save(); res.json({ success: true, data: record });
}));
router.delete('/applications/:id', verifyToken, id, run(async (req, res) => {
  const result = await Application.deleteOne({ _id: req.params.id, userId: req.user.userId }); res.status(result.deletedCount ? 200 : 404).json({ success: !!result.deletedCount });
}));
router.all('/reminders/run', run(async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) return res.status(401).json({ success: false, error: 'Unauthorized scheduled job' });
  res.json({ success: true, data: await sendDueReminders() });
}));
router.use('/staff', verifyToken, requireRole('admin', 'counsellor'));
const staffFilter = req => req.user.role === 'admin' ? {} : { staffId: req.user.userId };
router.get('/staff/slots', run(async (req, res) => res.json({ success: true, data: await CounsellingSlot.find(staffFilter(req)).sort('-startAt').limit(200) })));
router.post('/staff/slots', body('startAt').isISO8601(), body('durationMinutes').isIn([15, 30, 45, 60]), body('label').optional().isString().isLength({ max: 100 }), validate, run(async (req, res) => {
  const startAt = new Date(req.body.startAt), durationMinutes = Number(req.body.durationMinutes);
  if (startAt <= new Date()) return res.status(400).json({ success: false, error: 'Choose a future time.' });
  const existing = await CounsellingSlot.find({ staffId: req.user.userId, cancelled: false, startAt: { $lt: new Date(+startAt + durationMinutes * 60000) } });
  if (existing.some(s => +s.startAt + s.durationMinutes * 60000 > +startAt)) return res.status(409).json({ success: false, error: 'This overlaps an existing slot.' });
  const slot = await CounsellingSlot.create({ staffId: req.user.userId, startAt, durationMinutes, label: req.body.label || 'Counselling session' }); res.status(201).json({ success: true, data: slot });
}));
router.delete('/staff/slots/:id', id, run(async (req, res) => {
  const result = await CounsellingSlot.findOneAndUpdate({ _id: req.params.id, ...staffFilter(req), booked: false }, { $set: { cancelled: true } });
  res.status(result ? 200 : 409).json({ success: !!result, error: result ? undefined : 'Booked slots must be managed through their appointment.' });
}));
router.get('/staff/appointments', run(async (req, res) => {
  const slots = await CounsellingSlot.find(staffFilter(req)).select('_id');
  res.json({ success: true, data: await Appointment.find({ slotId: { $in: slots.map(s => s._id) } }).populate('slotId', 'startAt label').sort('-createdAt').limit(200) });
}));
router.patch('/staff/appointments/:id', id, body('status').isIn(['completed', 'cancelled', 'booked']), body('staffNotes').optional().isString().isLength({ max: 2000 }), validate, run(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ success: false });
  const slot = await CounsellingSlot.findOne({ _id: appointment.slotId, ...staffFilter(req) });
  if (!slot) return res.status(403).json({ success: false });
  if (appointment.status === 'cancelled' && req.body.status !== 'cancelled') return res.status(409).json({ success: false, error: 'A cancelled appointment cannot be reopened. Make a new booking.' });
  appointment.status = req.body.status; appointment.staffNotes = req.body.staffNotes || ''; await appointment.save();
  if (appointment.status === 'cancelled') await CounsellingSlot.updateOne({ _id: slot._id, bookingRef: appointment.reference }, { $set: { booked: false, bookingRef: null } });
  res.json({ success: true });
}));
router.post('/staff/reminders/run', requireRole('admin'), run(async (req, res) => res.json({ success: true, data: await sendDueReminders() })));
router.get('/staff/reviews', requireRole('admin'), run(async (req, res) => res.json({ success: true, data: await Review.find({ $or: [{ moderationStatus: 'pending' }, { moderationStatus: { $exists: false } }] }).populate('collegeId', 'name').sort('-createdAt').limit(20) })));
router.patch('/staff/reviews/:id', requireRole('admin'), id, body('status').isIn(['published', 'rejected']), validate, run(async (req, res) => {
  const review = await Review.findById(req.params.id); if (!review) return res.status(404).json({ success: false });
  review.moderationStatus = req.body.status; review.moderatedAt = new Date(); await review.save();
  const published = await Review.find({ collegeId: review.collegeId, moderationStatus: 'published' }).select('rating');
  await College.updateOne({ _id: review.collegeId }, { $set: { ratingCount: published.length, ratingAverage: published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : 0 } });
  res.json({ success: true });
}));
module.exports = router;
