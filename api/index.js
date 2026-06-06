const app = require('../server/server.js');
const connectDB = require('../server/config/db.js');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection error in Vercel serverless function:', error);
    return res.status(500).json({ success: false, error: 'Database connection failed' });
  }
  return app(req, res);
};
