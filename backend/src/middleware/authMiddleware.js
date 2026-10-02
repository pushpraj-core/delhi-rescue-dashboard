const jwt = require('jsonwebtoken');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // In production, JWT_SECRET should be defined
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev';
    const decoded = jwt.verify(token, secret);
    
    // Load user to get the role (actorRole)
    const user = await User.findOne({ email: decoded.email, active: true });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found or inactive' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };
