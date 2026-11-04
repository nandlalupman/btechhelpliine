const mongoose = require('mongoose');
const Story = require('../models/StudentStory');
async function publishedStories() {
  if (mongoose.connection.readyState !== 1) return [];
  const rows = await Story.find({ status: 'published', consent: true }).sort('-updatedAt').limit(12).populate('userId', 'isActive isVerified').lean();
  return rows.filter(row => row.userId?.isActive && row.userId.isVerified).map(row => ({ displayName: row.displayName, message: row.message }));
}
module.exports = { publishedStories };
