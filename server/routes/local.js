const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const isLocalPreview = req => process.env.LOCAL_PREVIEW === '1' && process.env.NODE_ENV !== 'production' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
router.use((req, res, next) => {
  if (!isLocalPreview(req)) return res.status(404).json({ success: false, error: 'Not found' });
  // A cross-origin website cannot read local verification messages.
  const origin = req.get('origin');
  if (origin && origin !== process.env.FRONTEND_URL && origin !== `http://127.0.0.1:${process.env.PORT || 4173}`) return res.sendStatus(403);
  if (!/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(req.get('host') || '')) return res.sendStatus(403);
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/outbox', (req, res) => {
  const directory = require('../utils/email').outboxDirectory;
  const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => /^\d+-[a-f0-9]+\.json$/.test(name)).sort().reverse().slice(0, 30) : [];
  res.json({ success: true, data: files.map(name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))) });
});
module.exports = router;
module.exports.isLocalPreview = isLocalPreview;
