const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('FATAL: JWT_SECRET is not set');
  }
  return secret || 'test_secret_only';
}

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());
    
    // Load user to get the role and jurisdiction
    const user = await User.findOne({ email: decoded.email, active: true });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found or inactive' });
    }
    
    // Pending users cannot access protected routes
    if (user.role === 'pending') {
      return res.status(403).json({ error: 'PENDING_APPROVAL: Your account has not been approved yet' });
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

/**
 * Middleware to scope ticket queries to the officer's jurisdiction.
 * Admins see everything. Officers see only their jurisdiction + transferred tickets.
 */
const scopeToJurisdiction = (req, res, next) => {
  if (req.user.role === 'admin') {
    req.jurisdictionFilter = {};  // No filter for admins
  } else {
    req.jurisdictionFilter = { district_id: req.user.jurisdiction };
  }
  next();
};

module.exports = { requireAuth, requireRole, scopeToJurisdiction, getJwtSecret };
