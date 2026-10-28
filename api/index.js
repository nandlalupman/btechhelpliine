const app = require('../server/server.js');
const connectDB = require('../server/config/db.js');

module.exports = async (req, res) => {
  const databaseRoute = req.url.startsWith('/api/') && !['/api/discovery', '/api/tools/'].some(prefix => req.url.startsWith(prefix));
  if (process.env.MONGODB_URI || databaseRoute) {
    try {
      await connectDB();
    } catch (error) {
      console.error('Database connection error:', error.message);
      if (databaseRoute) return res.status(503).json({ success: false, error: 'Online service temporarily unavailable. Please try again or contact our team.' });
    }
  }
  return app(req, res);
};
