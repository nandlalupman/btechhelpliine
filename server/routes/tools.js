const express = require('express');
const { searchRanks, rankMetadata } = require('../services/ranks');
const { answer } = require('../services/help');
const router = express.Router();
router.get('/ranks', (req, res) => res.json({ success: true, data: rankMetadata() }));
router.post('/ranks', (req, res) => {
  try {
    const { rank, exam, category, quota, gender, programme = '', institute = '', includeBeyond = false } = req.body;
    if ([programme, institute].some(x => typeof x !== 'string' || x.length > 150)) throw new Error('Use shorter search filters.');
    res.json({ success: true, data: searchRanks({ rank: Number(rank), exam, category, quota, gender, programme, institute, includeBeyond: includeBeyond === true }) });
  } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});
router.post('/help', (req, res) => {
  if (typeof req.body.question !== 'string' || !req.body.question.trim() || req.body.question.length > 500) return res.status(400).json({ success: false, error: 'Ask a question of up to 500 characters.' });
  res.json({ success: true, data: answer(req.body.question, req.body.language === 'hi' ? 'hi' : 'en') });
});
module.exports = router;
