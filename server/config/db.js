const mongoose = require('mongoose');
let pendingConnection = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (pendingConnection) return pendingConnection;
  if (process.env.VERCEL && !process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is missing in Vercel environment settings');
  }
  // Concurrent serverless requests share one connection attempt. A resolved
  // connection is not cached forever: disconnected instances must reconnect.
  pendingConnection = mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/btechhelpline', {
    serverSelectionTimeoutMS: 10000
  }).catch(error => {
    console.error('Database Connection Error:', error.message);
    if (!process.env.VERCEL) return null;
    throw error;
  }).finally(() => { pendingConnection = null; });
  return pendingConnection;
};
module.exports = connectDB;
