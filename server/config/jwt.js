const mongoose = require('mongoose');
const crypto = require('crypto');

let cachedSecret = null;

/**
 * Resolves the JWT secret.
 * 1. Checks process.env.JWT_SECRET (excluding default weak fallback).
 * 2. Returns cached in-memory secret if already resolved.
 * 3. Fetches from MongoDB settings collection. Generates and stores one if not found.
 * 4. Falls back to a randomly generated ephemeral secret if DB connection fails.
 */
const getJwtSecret = async () => {
  // 1. Check env variable (if set and not the weak default)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'btech-helpline-default-secret-key-999!') {
    return process.env.JWT_SECRET;
  }

  // 2. Return cached secret
  if (cachedSecret) {
    return cachedSecret;
  }

  // 3. Look up in MongoDB settings collection
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not initialized');
    }

    const settingsCol = db.collection('settings');
    let secretDoc = await settingsCol.findOne({ key: 'jwt_secret' });

    if (!secretDoc) {
      // Generate a new 64-byte random hex string
      const newSecret = crypto.randomBytes(64).toString('hex');
      await settingsCol.insertOne({
        key: 'jwt_secret',
        value: newSecret,
        createdAt: new Date()
      });
      console.log('Successfully generated and stored a secure JWT_SECRET in MongoDB Settings.');
      cachedSecret = newSecret;
    } else {
      cachedSecret = secretDoc.value;
    }

    return cachedSecret;
  } catch (error) {
    console.warn(`Dynamic JWT Secret Lookup failed (${error.message}). Falling back to ephemeral in-memory secret.`);
    if (!cachedSecret) {
      cachedSecret = crypto.randomBytes(64).toString('hex');
    }
    return cachedSecret;
  }
};

module.exports = { getJwtSecret };
