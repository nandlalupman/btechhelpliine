const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.LOCAL_PREVIEW = '1';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.LOCAL_OUTBOX_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'btech-test-mail-'));
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const app = require('../server/server');
const User = require('../server/models/User');
const College = require('../server/models/College');
const Review = require('../server/models/Review');
const Lead = require('../server/models/Lead');
const ConversationMessage = require('../server/models/ConversationMessage');
const StudentStory = require('../server/models/StudentStory');
const { Application, CounsellingSlot, Appointment } = require('../server/models/Journey');
const { searchRanks } = require('../server/services/ranks');
const { sendDueReminders } = require('../server/services/reminders');
const dataset = require('../server/data/cutoffs.json');
let database, server, base, admin, student, other, counsellor, anotherCounsellor, college;
const auth = user => jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
async function request(url, method = 'GET', body, user) {
  const response = await fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(user ? { Authorization: 'Bearer ' + auth(user) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  database = await MongoMemoryServer.create({ binary: { downloadDir: path.join(__dirname, '../.local/mongodb-binaries') }, instance: { dbName: 'btech_feature_tests', ip: '127.0.0.1' } });
  await mongoose.connect(database.getUri());
  await Promise.all([User.init(), College.init(), Review.init(), Lead.init(), ConversationMessage.init(), StudentStory.init(), CounsellingSlot.init(), Appointment.init()]);
  [admin, student, other, counsellor, anotherCounsellor] = await User.create(['admin', 'student', 'student', 'counsellor', 'counsellor'].map((role, index) => ({ name: `Feature test ${index}`, email: `feature-${index}@example.invalid`, phone: `900000000${index}`, password: 'test-only-unused-hash', role, isVerified: true })));
  college = await College.create({ name: 'Test institute', city: 'Test city', state: 'Rajasthan', type: 'Other', description: 'An isolated test fixture.', admissionMode: 'Confirm with institution', cutoffRankCSE: 'Not verified' });
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (database) await database.stop();
  for (const name of fs.readdirSync(process.env.LOCAL_OUTBOX_DIR)) fs.unlinkSync(path.join(process.env.LOCAL_OUTBOX_DIR, name));
  fs.rmdirSync(process.env.LOCAL_OUTBOX_DIR);
});

test('rank explorer preserves exam, category, quota and gender rank basis', () => {
  const row = dataset.records.find(r => r.exam === 'JEE Advanced' && r.category === 'OBC-NCL' && r.quota === 'AI' && r.gender === 'Gender-Neutral');
  const result = searchRanks({ rank: row.closing, exam: row.exam, category: row.category, quota: row.quota, gender: row.gender, institute: row.institute, programme: row.programme });
  assert.ok(result.records.length); assert.equal(result.rankBasis, 'OBC-NCL category rank');
  assert.ok(result.records.every(r => r.exam === row.exam && r.category === row.category && r.quota === row.quota && r.gender === row.gender));
  assert.ok(result.records.some(r => r.closing === row.closing && r.withinClosing));
  assert.equal(searchRanks({ rank: 1, exam: 'JEE Main', institute: 'Indian Institute of Technology' }).records.length, 0);
  assert.throws(() => searchRanks({ rank: 99.4 }), /rank/); assert.throws(() => searchRanks({ rank: 1, category: 'invalid' }), /category/);
});

test('new public tools render HTML and private pages stay out of sitemap', async () => {
  for (const url of ['/tools/', '/rank-explorer/', '/applications/', '/appointments/', '/admission-help/', '/staff/', '/local-tools/']) {
    const response = await fetch(base + url); assert.equal(response.status, 200, url); const html = await response.text();
    assert.equal((html.match(/<h1>/g) || []).length, 1); assert.match(html, /\/assets\/logos\/logo.png/); assert.match(html, /\/journey.js/);
    if (['/applications/', '/appointments/', '/staff/', '/local-tools/'].includes(url)) assert.match(html, /noindex, follow/);
  }
  const xml = await (await fetch(base + '/sitemap.xml')).text(); assert.match(xml, /\/rank-explorer\//); assert.ok(!xml.includes('/applications/')); assert.ok(!xml.includes('/staff/'));
  assert.equal((await request('/api/tools/ranks', 'POST', { rank: 1000 })).status, 200);
  const help = await request('/api/tools/help', 'POST', { question: 'कटऑफ कैसे देखें?', language: 'hi' }); assert.match(help.body.data.answer, /रैंक/);
});

test('applications require auth, remain owner-bound and validate input', async () => {
  const payload = { title: 'Test application', deadline: new Date(Date.now() + 3600000).toISOString(), sourceUrl: 'https://josaa.nic.in/', status: 'planning', notes: '<script>not executed</script>', emailReminder: true };
  assert.equal((await request('/api/journey/applications')).status, 401);
  const created = await request('/api/journey/applications', 'POST', payload, student); assert.equal(created.status, 201);
  const id = created.body.data._id;
  assert.equal((await request('/api/journey/applications', 'GET', null, other)).body.data.length, 0);
  assert.equal((await request('/api/journey/applications/' + id, 'PUT', payload, other)).status, 404);
  assert.equal((await request('/api/journey/applications/' + id, 'DELETE', null, other)).status, 404);
  assert.equal((await request('/api/journey/applications', 'POST', { ...payload, sourceUrl: 'javascript:alert(1)' }, student)).status, 400);
  const changed = await request('/api/journey/applications/' + id, 'PUT', { ...payload, title: 'Updated application' }, student); assert.equal(changed.body.data.title, 'Updated application');
  assert.equal((await request('/api/journey/applications/' + id, 'DELETE', null, student)).status, 200);
});

test('staff permissions, published slots, atomic double-book prevention and cancellation', async () => {
  const slotData = { startAt: new Date(Date.now() + 48 * 3600000).toISOString(), durationMinutes: 30, label: 'Test session' };
  assert.equal((await request('/api/journey/staff/slots', 'POST', slotData, student)).status, 403);
  const created = await request('/api/journey/staff/slots', 'POST', slotData, admin); assert.equal(created.status, 201);
  const id = created.body.data._id;
  assert.equal((await request('/api/journey/staff/slots', 'POST', { ...slotData, startAt: new Date(+new Date(slotData.startAt) + 600000).toISOString() }, admin)).status, 409);
  const payload = { name: 'Test booking', email: 'booking@example.invalid', phone: '9000000010', question: 'Test only', contactConsent: true };
  assert.equal((await request('/api/journey/appointments/' + id, 'POST', { ...payload, contactConsent: false })).status, 400);
  const attempts = await Promise.all([request('/api/journey/appointments/' + id, 'POST', payload), request('/api/journey/appointments/' + id, 'POST', payload)]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
  const booking = attempts.find(r => r.status === 201).body;
  assert.equal(booking.notification, 'local-preview'); assert.equal(booking.data.reference.length, 36);
  const lookup = await request('/api/journey/appointments/manage', 'POST', { reference: booking.data.reference });
  assert.equal(lookup.status, 200); assert.equal(lookup.body.data.status, 'booked'); assert.ok(!JSON.stringify(lookup.body).includes(payload.phone));
  const cancelled = await request('/api/journey/appointments/manage', 'POST', { reference: booking.data.reference, cancel: true }); assert.equal(cancelled.body.data.status, 'cancelled');
  assert.equal((await CounsellingSlot.findById(id)).booked, false);
});

test('deadline reminders respect opt-in and process each saved deadline once', async () => {
  const now = new Date();
  const values = { userId: student._id, title: 'Test deadline', deadline: new Date(+now + 7200000) };
  const enabled = await Application.create({ ...values, emailReminder: true });
  const off = await Application.create({ ...values, emailReminder: false });
  await Application.create({ ...values, emailReminder: true, status: 'reported' });
  const first = await sendDueReminders(now); assert.equal(first.sent, 1); assert.equal(first.delivery, 'local-preview');
  assert.equal((await sendDueReminders(now)).sent, 0);
  assert.ok((await Application.findById(enabled._id)).reminderSentAt); assert.equal((await Application.findById(off._id)).reminderSentAt, null);
  assert.equal((await request('/api/journey/reminders/run')).status, 401);
});

test('reviews stay private until moderation and editing withdraws publication', async () => {
  const payload = { rating: 4, comment: 'Test review for moderation only.', ratings: { academics: 4, placements: 3, infrastructure: 4, socialLife: 4 } };
  const created = await request(`/api/colleges/${college._id}/reviews`, 'POST', payload, student); assert.equal(created.status, 201); assert.equal(created.body.data.moderationStatus, 'pending');
  const id = created.body.data._id;
  assert.equal((await request(`/api/colleges/${college._id}/reviews`)).body.data.length, 0);
  assert.equal((await request('/api/journey/staff/reviews/' + id, 'PATCH', { status: 'published' }, student)).status, 403);
  assert.equal((await request('/api/journey/staff/reviews/' + id, 'PATCH', { status: 'published' }, admin)).status, 200);
  const published = (await request(`/api/colleges/${college._id}/reviews`)).body.data; assert.equal(published.length, 1); assert.ok(!published[0].studentId);
  assert.equal((await College.findById(college._id)).ratingCount, 1);
  await request(`/api/colleges/${college._id}/reviews`, 'POST', { ...payload, comment: 'Changed test review needs approval.' }, student);
  assert.equal((await request(`/api/colleges/${college._id}/reviews`)).body.data.length, 0); assert.equal((await College.findById(college._id)).ratingCount, 0);
});

test('private message pages render and are excluded from public search indexing', async () => {
  for (const url of ['/messages/', '/inbox/']) {
    const response = await fetch(base + url); const html = await response.text(); assert.equal(response.status, 200); assert.match(html, /noindex, follow/); assert.match(html, /\/messages.js/); assert.match(html, /\/assets\/logos\/logo.png/);
  }
  const sitemap = await (await fetch(base + '/sitemap.xml')).text(); assert.ok(!sitemap.includes('/messages/')); assert.ok(!sitemap.includes('/inbox/'));
});

const enquiry = extra => ({ name: 'Message flow test', mobile: '9000000088', email: 'message-test@example.invalid', branch: 'Not Sure', state: 'To discuss', subject: 'Help comparing branches', message: 'I would like help comparing my branch choices.', contactConsent: true, partnerConsent: false, ...extra });
test('anonymous messages persist and the private tracking key is required, hashed and recoverable', async () => {
  assert.equal((await request('/api/leads', 'POST', enquiry({ contactConsent: false }))).status, 400);
  const created = await request('/api/leads', 'POST', enquiry()); assert.equal(created.status, 201);
  const { leadId, accessKey } = created.body.data; assert.match(accessKey, /^[a-f0-9]{64}$/);
  const stored = await Lead.findById(leadId).select('+trackingTokenHash'); assert.equal(stored.message, enquiry().message); assert.equal(stored.subject, enquiry().subject); assert.equal(stored.contactConsent, true); assert.notEqual(stored.trackingTokenHash, accessKey); assert.equal(stored.trackingTokenHash.length, 64);
  assert.equal((await request('/api/messages/thread/' + leadId, 'POST', {})).status, 403);
  assert.equal((await request('/api/messages/thread/' + leadId, 'POST', { accessKey: '0'.repeat(64) })).status, 403);
  assert.equal((await request('/api/leads/' + leadId)).status, 401);
  const recovered = await request('/api/messages/access', 'POST', { accessKey }); assert.equal(recovered.body.data._id, leadId);
  const opened = await request('/api/messages/thread/' + leadId, 'POST', { accessKey }); assert.equal(opened.status, 200); assert.ok(!JSON.stringify(opened.body).includes(stored.trackingTokenHash)); assert.ok(!Object.hasOwn(opened.body.data.request, 'notes'));
  const reply = await request('/api/messages/thread/' + leadId + '/reply', 'POST', { accessKey, text: 'A follow-up question from the anonymous student.' }); assert.equal(reply.status, 201);
  assert.equal((await ConversationMessage.findOne({ leadId })).body, 'A follow-up question from the anonymous student.');
});

test('account messages enforce ownership, staff assignment and private internal notes', async () => {
  const created = await request('/api/leads', 'POST', enquiry({ email: student.email }), student); const id = created.body.data.leadId;
  assert.equal(String((await Lead.findById(id)).userId), String(student._id));
  assert.equal((await request('/api/messages/thread/' + id, 'POST', {}, student)).status, 200);
  assert.equal((await request('/api/messages/thread/' + id, 'POST', {}, other)).status, 403);
  assert.equal((await request('/api/messages/staff')).status, 401);
  assert.equal((await request('/api/messages/staff', 'GET', null, student)).status, 403);
  for (const route of ['/api/messages/staff/' + id, '/api/counsellor/leads/' + id]) assert.equal((await request(route, 'GET', null, counsellor)).status, 403, route);
  assert.equal((await request('/api/counsellor/leads/' + id + '/status', 'PUT', { status: 'contacted' }, counsellor)).status, 403);
  assert.equal((await request('/api/counsellor/leads/' + id + '/notes', 'POST', { text: 'Not allowed' }, counsellor)).status, 403);
  assert.equal((await request('/api/messages/staff/' + id, 'PATCH', { assignedTo: student._id }, admin)).status, 400);
  assert.equal((await request('/api/messages/staff/' + id, 'PATCH', { assignedTo: counsellor._id, priority: 'high', followUpAt: new Date(Date.now() - 60000).toISOString() }, admin)).status, 200);
  const queue = await request('/api/messages/staff?followUp=1', 'GET', null, counsellor); assert.ok(queue.body.data.leads.some(item => item._id === id));
  assert.equal((await request('/api/messages/staff/' + id, 'GET', null, anotherCounsellor)).status, 403);
  assert.equal((await request('/api/messages/staff/' + id, 'PATCH', { assignedTo: anotherCounsellor._id }, counsellor)).status, 403);
  const reply = await request('/api/messages/staff/' + id + '/reply', 'POST', { text: 'The assigned counsellor reply.', notify: true }, counsellor); assert.equal(reply.status, 201); assert.equal(reply.body.data.delivery, 'local-preview');
  const teamMessage = await ConversationMessage.findById(reply.body.data._id); assert.equal(teamMessage.senderType, 'team'); assert.equal(String(teamMessage.senderId), String(counsellor._id));
  assert.equal((await request('/api/messages/staff/' + id + '/notes', 'POST', { text: 'PRIVATE INTERNAL TEST NOTE' }, counsellor)).status, 201);
  assert.ok((await Lead.findById(id)).notes.some(note => note.text === 'PRIVATE INTERNAL TEST NOTE'));
  for (const response of [await request('/api/messages/thread/' + id, 'POST', {}, student), await request('/api/user/my-leads', 'GET', null, student), await request('/api/leads/' + id, 'GET', null, student)]) {
    assert.ok(!JSON.stringify(response.body).includes('PRIVATE INTERNAL TEST NOTE')); assert.ok(!JSON.stringify(response.body).includes('trackingTokenHash'));
  }
  const thread = await request('/api/messages/thread/' + id, 'POST', {}, student); assert.ok(thread.body.data.messages.some(message => message.body === 'The assigned counsellor reply.'));
  assert.equal((await request('/api/messages/staff/' + id, 'PATCH', { status: 'closed', followUpAt: null }, counsellor)).status, 200);
  assert.equal((await request('/api/messages/thread/' + id + '/reply', 'POST', { text: 'Cannot reply to a closed request' }, student)).status, 409);
  assert.equal((await request('/api/messages/staff/' + id + '/reply', 'POST', { text: 'Cannot reply to a closed request' }, counsellor)).status, 409);
});

test('conversation history paginates without leaking unrelated requests', async () => {
  const created = await request('/api/leads', 'POST', enquiry(), student); const id = created.body.data.leadId;
  await ConversationMessage.insertMany(Array.from({ length: 54 }, (_, i) => ({ leadId: id, senderId: student._id, senderType: 'student', body: 'History test ' + i })));
  const latest = await request('/api/messages/thread/' + id, 'POST', {}, student); assert.equal(latest.body.data.messages.length, 50); assert.ok(latest.body.data.nextCursor);
  const older = await request('/api/messages/thread/' + id, 'POST', { before: latest.body.data.nextCursor }, student); assert.equal(older.body.data.messages.length, 4); assert.equal(older.body.data.nextCursor, null);
  const ids = [...latest.body.data.messages, ...older.body.data.messages].map(item => item._id); assert.equal(new Set(ids).size, 54);
});

test('real registration creates a local email OTP, verification enables password login', async () => {
  const email = 'register-test@example.invalid';
  const result = await request('/api/auth/register', 'POST', { name: 'Registration test', email, phone: '9000000099', password: 'TestPasswordA72!' });
  assert.equal(result.status, 201); assert.match(result.body.otp, /^\d{6}$/);
  const verified = await request('/api/auth/verify-email-otp', 'POST', { email, otp: result.body.otp }); assert.equal(verified.status, 200); assert.ok(verified.body.token);
  const login = await request('/api/auth/login', 'POST', { email, password: 'TestPasswordA72!' }); assert.equal(login.status, 200);
  assert.equal((await request('/api/auth/verify-email-otp', 'POST', { email, otp: result.body.otp })).status, 400);
  const inbox = await request('/api/dev/outbox'); assert.equal(inbox.status, 200); assert.ok(inbox.body.data.some(item => item.to === email && item.text.includes(result.body.otp)));
  const blocked = await fetch(base + '/api/dev/outbox', { headers: { Origin: 'https://unrelated.example' } }); assert.equal(blocked.status, 403);
  const originalMode = process.env.NODE_ENV;
  try { process.env.NODE_ENV = 'production'; assert.equal((await request('/api/dev/outbox')).status, 404); assert.equal((await fetch(base + '/local-tools/')).status, 404); } finally { process.env.NODE_ENV = originalMode; }
});

test('student recovers an expired verification code, logs in, reads a team response and replies privately', async () => {
  const email = 'student-journey@example.invalid', password = 'StudentFlowA72!';
  const registration = await request('/api/auth/register', 'POST', { name: 'Student journey', email: ' STUDENT-JOURNEY@example.invalid ', phone: '9000000077', password });
  assert.equal(registration.status, 201);
  const account = await User.findOne({ email });
  assert.equal((await request('/api/user/me', 'GET', null, account)).status, 403);
  assert.equal((await request('/api/auth/send-otp', 'POST', { phone: account.phone })).status, 403);
  await User.updateOne({ _id: account._id }, { emailOtpExpires: new Date(Date.now() - 1000) });
  assert.equal((await request('/api/auth/verify-email-otp', 'POST', { email, otp: registration.body.otp })).status, 400);
  const resent = await request('/api/auth/resend-email-otp', 'POST', { email });
  assert.equal(resent.status, 200);
  assert.equal((await request('/api/auth/verify-email-otp', 'POST', { email, otp: resent.body.otp })).status, 200);
  const login = await request('/api/auth/login', 'POST', { email: email.toUpperCase(), password });
  assert.equal(login.status, 200); assert.ok(login.body.token);
  await User.updateOne({ _id: account._id }, { resetPasswordToken: 'private-reset-fixture', otpCode: '123123' });
  const profile = await request('/api/user/me', 'GET', null, account);
  assert.equal(profile.body.data.isVerified, true);
  for (const key of ['password', 'otpCode', 'emailOtpCode', 'resetPasswordToken']) assert.ok(!Object.hasOwn(profile.body.data, key));
  const created = await request('/api/leads', 'POST', enquiry({ email, mobile: account.phone }), account);
  assert.equal(created.status, 201); const id = created.body.data.leadId;
  assert.equal((await request('/api/messages/staff/' + id + '/reply', 'POST', { text: 'Compare the official fee schedules first.', notify: false }, admin)).status, 201);
  let mine = await request('/api/user/my-leads', 'GET', null, account);
  assert.equal(mine.body.data[0].lastMessageFrom, 'team');
  assert.ok(!mine.body.data[0].studentReadAt);
  const opened = await request('/api/messages/thread/' + id, 'POST', {}, account);
  assert.ok(opened.body.data.messages.some(row => row.body === 'Compare the official fee schedules first.'));
  assert.ok(opened.body.data.request.studentReadAt);
  assert.equal((await request('/api/messages/thread/' + id, 'POST', {}, other)).status, 403);
  assert.equal((await request('/api/messages/thread/' + id + '/reply', 'POST', { text: 'Thank you, please help me compare hostel costs too.' }, account)).status, 201);
  assert.equal(await ConversationMessage.countDocuments({ leadId: id }), 2);
  assert.equal((await request('/api/user/me/password', 'PUT', { oldPassword: 'wrong-password', newPassword: 'UpdatedStudentA72!' }, account)).status, 400);
  assert.equal((await request('/api/user/me/password', 'PUT', { oldPassword: password, newPassword: 'UpdatedStudentA72!' }, account)).status, 200);
  assert.equal((await request('/api/auth/login', 'POST', { email, password })).status, 401);
  assert.equal((await request('/api/auth/login', 'POST', { email, password: 'UpdatedStudentA72!' })).status, 200);
});

test('homepage experiences require student consent and admin selection, and edits or withdrawal remove publication', async () => {
  const endpoint = '/api/student-stories';
  const payload = { displayName: 'Student <test>', message: 'Thank you for explaining the options. <script>window.bad=true</script>', consent: true };
  assert.equal((await request(endpoint + '/mine')).status, 401);
  assert.equal((await request(endpoint + '/staff', 'GET', null, student)).status, 403);
  assert.equal((await request(endpoint + '/mine', 'PUT', { ...payload, consent: false }, student)).status, 400);
  assert.equal((await request(endpoint + '/mine', 'PUT', payload, counsellor)).status, 403);
  const created = await request(endpoint + '/mine', 'PUT', { ...payload, userId: other._id }, student);
  assert.equal(created.status, 200);
  const story = created.body.data;
  assert.equal(story.userId, String(student._id));
  assert.equal(story.status, 'pending');
  assert.equal(await StudentStory.countDocuments({ userId: student._id }), 1);
  assert.equal((await request(endpoint + '/mine', 'GET', null, other)).body.data, null);
  assert.deepEqual((await request(endpoint)).body.data, []);
  const select = (revision, user = admin) => request(endpoint + '/staff/' + story._id, 'PATCH', { status: 'published', revision }, user);
  assert.equal((await select(story.revision, student)).status, 403);
  assert.equal((await select(story.revision)).status, 200);
  assert.deepEqual((await request(endpoint)).body.data, [{ displayName: payload.displayName, message: payload.message }]);
  const home = await fetch(base + '/');
  assert.match(home.headers.get('cache-control'), /no-store/);
  const html = await home.text();
  assert.match(html, /Student &lt;test&gt;/);
  assert.match(html, /&lt;script&gt;window.bad=true&lt;\/script&gt;/);
  assert.ok(!html.includes('<script>window.bad=true</script>'));
  assert.ok(!html.includes('PRIVATE INTERNAL TEST NOTE'));
  await User.updateOne({ _id: student._id }, { isActive: false });
  assert.deepEqual((await request(endpoint)).body.data, []);
  await User.updateOne({ _id: student._id }, { isActive: true });
  const updated = await request(endpoint + '/mine', 'PUT', { ...payload, message: 'Updated experience needs a fresh review.' }, student);
  assert.equal(updated.body.data.revision, story.revision + 1);
  assert.equal(updated.body.data.status, 'pending');
  assert.deepEqual((await request(endpoint)).body.data, []);
  assert.equal((await select(story.revision)).status, 409);
  assert.equal((await select(updated.body.data.revision)).status, 200);
  assert.equal((await request(endpoint + '/mine', 'DELETE', null, student)).status, 200);
  assert.equal(await StudentStory.countDocuments({ userId: student._id }), 0);
  assert.deepEqual((await request(endpoint)).body.data, []);
  assert.equal((await select(updated.body.data.revision)).status, 409);
  const verification = await fetch(base + '/verify-email/');
  assert.equal(verification.status, 200);
  assert.match(await verification.text(), /student-verification-form/);
});
