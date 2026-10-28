const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
const local = path.join(root, '.local');
(async () => {
  if (!process.env.MONGODB_URI) {
    const { MongoMemoryServer } = require('mongodb-memory-server-core');
    const dbPath = path.join(local, 'database');
    fs.mkdirSync(dbPath, { recursive: true });
    console.log('Starting persistent local development database…');
    const database = await MongoMemoryServer.create({
      binary: { downloadDir: path.join(local, 'mongodb-binaries') },
      instance: { dbPath, storageEngine: 'wiredTiger', ip: '127.0.0.1', port: 27018 }
    });
    process.env.MONGODB_URI = database.getUri('btechhelpline');
    process.env.LOCAL_PREVIEW = '1';
    process.env.FRONTEND_URL = `http://localhost:${process.env.PORT || 4173}`;
    fs.writeFileSync(path.join(local, 'database.json'), JSON.stringify({ uri: process.env.MONGODB_URI }));
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    const College = require('../server/models/College');
    if (await College.countDocuments() === 0) {
      const directory = require('../server/data/directory.json');
      await College.insertMany(directory.map(c => ({ ...c, cutoffRankCSE: 'Not verified', description: `${c.name} is listed in ${c.city}, ${c.state}. Confirm current information with the institution.`, dataStatus: 'needs_review' })));
      console.log('Initial directory added to the empty local database.');
    }
    const User = require('../server/models/User');
    const email = 'admin@btechhelpline.local';
    if (!await User.exists({ email })) {
      const password = `Local-${crypto.randomBytes(12).toString('hex')}A7!`;
      await User.create({ name: 'Local administrator', email, phone: '9999999999', password: await require('bcryptjs').hash(password, 12), role: 'admin', isVerified: true });
      fs.writeFileSync(path.join(local, 'access.json'), JSON.stringify({ email, password, note: 'Local development account only; never use these credentials in production.' }, null, 2), { mode: 0o600 });
    }
    console.log('Local database ready. Administrator login details: .local/access.json');
    await require('../server/services/collegeEvidence').syncEvidence();
    const { CounsellingSlot } = require('../server/models/Journey');
    if (!await CounsellingSlot.exists({ startAt: { $gt: new Date() }, cancelled: false })) {
      const admin = await User.findOne({ email });
      const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(11, 0, 0, 0);
      await CounsellingSlot.insertMany([0, 1, 2].map(i => ({ staffId: admin._id, startAt: new Date(+start + i * 3600000), durationMinutes: 30, label: 'Local preview counselling' })));
    }
  }
  require('../server/server');
})().catch(error => { console.error('Local startup failed:', error.message); process.exitCode = 1; });
