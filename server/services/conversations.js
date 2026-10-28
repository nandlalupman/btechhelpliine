const crypto = require('crypto');
const hashKey = value => crypto.createHash('sha256').update(value).digest('hex');
const canHandle = (lead, user) => user && (user.role === 'admin' || (user.role === 'counsellor' && String(lead.assignedTo?._id || lead.assignedTo || '') === String(user.userId)));
const owns = (lead, user) => user && String(lead.userId?._id || lead.userId || '') === String(user.userId);
function validKey(lead, key) {
  return typeof key === 'string' && /^[a-f0-9]{64}$/.test(key) && /^[a-f0-9]{64}$/.test(lead.trackingTokenHash || '') && crypto.timingSafeEqual(Buffer.from(lead.trackingTokenHash, 'hex'), Buffer.from(hashKey(key), 'hex'));
}
function studentView(lead) {
  return { _id: lead._id, subject: lead.subject || 'Admission counselling', message: lead.message, status: lead.status, preferredBranch: lead.preferredBranch, preferredState: lead.preferredState, budget: lead.budget, createdAt: lead.createdAt, lastMessageAt: lead.lastMessageAt, lastMessageFrom: lead.lastMessageFrom, studentReadAt: lead.studentReadAt, assigned: !!lead.assignedTo };
}
module.exports = { hashKey, canHandle, owns, validKey, studentView };
