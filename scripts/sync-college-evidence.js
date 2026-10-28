const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
(async () => {
  const local = path.join(__dirname, '../.local/database.json');
  const uri = process.env.MONGODB_URI || (fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, 'utf8')).uri : '');
  if (!uri) throw new Error('Configure MONGODB_URI or start npm run local first.');
  await mongoose.connect(uri);
  console.log(JSON.stringify(await require('../server/services/collegeEvidence').syncEvidence()));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
