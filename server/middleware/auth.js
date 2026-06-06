const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'btech-helpline-default-secret-key-999!';

const verifyToken = async (req, res, next) => {
  try {
    let token = '';

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user exists and is active
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User no longer exists' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account deactivated. Please contact support.' });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
    };

    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access restricted to [${roles.join(', ')}] roles`,
      });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  requireRole,
};
