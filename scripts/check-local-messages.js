// Exercise only this project's loopback development server. Test records are
// tagged with a unique subject and removed after the persistence check.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const Lead = require('../server/models/Lead');
const Message = require('../server/models/ConversationMessage');
const root = path.join(__dirname, '..');
const local = path.join(root, '.local');
let fixture, email, subject, base, bearer, uri;
const report = { startedAt: new Date().toISOString(), checks: {} };
async function request(url, method = 'GET', body, auth = false) {
  const response = await fetch(base + url, { method, headers: { Connection: 'close', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
async function cleanup() {
  if (mongoose.connection.readyState === 1 && fixture) {
    const owned = await Lead.findOne({ _id: fixture, subject, email });
    if (owned) { await Message.deleteMany({ leadId: owned._id }); await Lead.deleteOne({ _id: owned._id, subject, email }); }
    report.checks.testRecordsRemoved = !await Lead.exists({ _id: fixture });
  }
  const outbox = path.join(local, 'outbox');
  if (email && fs.existsSync(outbox)) for (const name of fs.readdirSync(outbox).filter(name => /^\d+-[a-f0-9]+\.json$/.test(name))) {
    const filename = path.join(outbox, name), item = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (item.to === email) fs.unlinkSync(filename);
  }
}
(async () => {
  const state = JSON.parse(fs.readFileSync(path.join(local, 'server.json'), 'utf8'));
  base = `http://127.0.0.1:${Number(state.port)}`;
  const health = await request('/health'); assert.equal(health.app, 'btechhelpline'); assert.equal(health.db, 'connected');
  await request('/api/dev/outbox'); // Fails unless this is the local preview.
  const access = JSON.parse(fs.readFileSync(path.join(local, 'access.json'), 'utf8'));
  uri = JSON.parse(fs.readFileSync(path.join(local, 'database.json'), 'utf8')).uri;
  assert.equal(new URL(uri).hostname, '127.0.0.1');
  const login = await request('/api/auth/login', 'POST', { email: access.email, password: access.password }); bearer = login.token;
  const marker = crypto.randomBytes(6).toString('hex'); email = `local-message-check-${marker}@example.invalid`; subject = `Local persistence check ${marker}`;
  const created = await request('/api/leads', 'POST', { name: 'Local message persistence check', email, mobile: '9000000077', branch: 'Not Sure', state: 'To discuss', subject, message: 'Local QA message. This temporary test record will be removed.', contactConsent: true, partnerConsent: false });
  fixture = created.data.leadId; report.testLeadId = fixture;
  await request('/api/messages/staff/' + fixture + '/reply', 'POST', { text: 'Local QA team reply saved in the conversation.', notify: false }, true);
  await request('/api/messages/staff/' + fixture + '/notes', 'POST', { text: 'PRIVATE LOCAL QA NOTE' }, true);
  await mongoose.connect(uri);
  const stored = await Lead.findById(fixture).select('+trackingTokenHash');
  assert.equal(stored.subject, subject); assert.notEqual(stored.trackingTokenHash, created.data.accessKey); assert.ok(stored.notes.some(note => note.text === 'PRIVATE LOCAL QA NOTE'));
  assert.equal(await Message.countDocuments({ leadId: fixture, senderType: 'team' }), 1);
  const thread = await request('/api/messages/thread/' + fixture, 'POST', { accessKey: created.data.accessKey });
  assert.ok(!JSON.stringify(thread).includes('PRIVATE LOCAL QA NOTE')); assert.equal(thread.data.messages.length, 1);
  report.checks.originalMessageSaved = true; report.checks.replySaved = true; report.checks.internalNotePrivate = true; report.checks.trackingKeyHashed = true;
  await mongoose.disconnect();
  console.log('Message, reply and private-note checks passed. Restarting the local app to verify persistence…');
  const restarted = spawnSync(process.execPath, [path.join(__dirname, 'local.js'), '--restart'], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 180000 });
  if (restarted.status !== 0) throw new Error('Local restart failed. Check .local/server.log.');
  assert.equal((await request('/health')).db, 'connected');
  await mongoose.connect(uri);
  assert.ok(await Lead.exists({ _id: fixture, subject })); assert.equal(await Message.countDocuments({ leadId: fixture }), 1);
  assert.ok((await Lead.findById(fixture)).notes.some(note => note.text === 'PRIVATE LOCAL QA NOTE'));
  const persisted = await request('/api/messages/thread/' + fixture, 'POST', { accessKey: created.data.accessKey }); assert.equal(persisted.data.messages.length, 1);
  report.checks.persistedAfterServerRestart = true;
  await cleanup(); report.success = true;
  console.log('Database persistence verified after restart. Temporary test messages removed.');
})().catch(error => { report.success = false; report.error = error.message; console.error('Local message check:', error.message); process.exitCode = 1; }).finally(async () => {
  try { await cleanup(); } catch (error) { report.cleanupError = error.message; process.exitCode = 1; }
  await mongoose.disconnect();
  if (fs.existsSync(local)) fs.writeFileSync(path.join(local, 'message-persistence-report.json'), JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2));
});
