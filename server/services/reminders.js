const mongoose = require('mongoose');
const { Application } = require('../models/Journey');
const email = require('../utils/email');
async function sendDueReminders(now = new Date()) {
  if (mongoose.connection.readyState !== 1) return { sent: 0, failed: 0 };
  const due = await Application.find({ emailReminder: true, reminderSentAt: null, deadline: { $gt: now, $lte: new Date(now.getTime() + 86400000) }, status: { $nin: ['closed', 'reported'] } }).populate('userId', 'email name').limit(100);
  let sent = 0, failed = 0;
  for (const item of due) {
    if (!item.userId?.email) continue;
    const claimed = await Application.findOneAndUpdate({ _id: item._id, deadline: item.deadline, emailReminder: true, status: { $nin: ['closed', 'reported'] }, reminderSentAt: null, $or: [{ reminderClaimedAt: null }, { reminderClaimedAt: { $lt: new Date(now.getTime() - 600000) } }] }, { $set: { reminderClaimedAt: now } }, { new: true });
    if (!claimed) continue;
    try {
      await email.sendCustomEmail(item.userId.email, 'Your saved admission deadline is approaching', `Your saved task: ${item.title}\nDeadline: ${item.deadline.toISOString()}\nSource: ${item.sourceUrl || 'Your own saved deadline'}\n\nThis is a reminder for a date you entered, not a verified announcement. Check the official source before acting.`);
      await Application.updateOne({ _id: item._id, deadline: item.deadline, reminderClaimedAt: now }, { $set: { reminderSentAt: now, reminderClaimedAt: null } }); sent++;
    } catch { await Application.updateOne({ _id: item._id, reminderClaimedAt: now }, { $set: { reminderClaimedAt: null } }); failed++; }
  }
  return { sent, failed, delivery: email.deliveryMode };
}
function startReminderWorker() {
  if (process.env.VERCEL) return;
  const timer = setInterval(() => sendDueReminders().catch(e => console.error('Reminder worker:', e.message)), 60000);
  timer.unref();
}
module.exports = { sendDueReminders, startReminderWorker };
