const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Returns the JWT_SECRET. Refuses to start without one outside of test environments.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to sign tokens with a fallback.');
  }
  return secret || 'test_secret_only';
}

// ──────────────────────────────────────────────
// POST /api/auth/google — Authenticate via Google OAuth2
// ──────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();

    // Sync user with database
    let user = await User.findOne({ email });
    if (!user) {
      // Whitelist logic for Hackathon Prototype:
      // Any @iiitnr.edu.in email is automatically approved as an admin.
      // Anyone else is 'pending' and blocked until approved by an admin.
      const isAllowedDomain = email.endsWith('@iiitnr.edu.in');
      const role = isAllowedDomain ? 'admin' : 'pending';
      
      user = await User.create({
        email,
        name: payload.name,
        role
      });
      console.log(`[Auth] New user created: ${email} with role: ${role}`);
    }

    if (!user.active) {
      return res.status(403).json({ error: 'User account is inactive. Contact an administrator.' });
    }

    if (user.role === 'pending') {
      return res.status(403).json({
        error: 'PENDING_APPROVAL',
        message: 'Your account is pending administrator approval. You will be notified when approved.'
      });
    }

    const sessionToken = jwt.sign(
      { email: user.email, name: user.name, role: user.role, jurisdiction: user.jurisdiction },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Authentication successful',
      token: sessionToken,
      user: {
        name: user.name,
        email: user.email,
        picture: payload.picture,
        role: user.role,
        jurisdiction: user.jurisdiction
      }
    });
  } catch (error) {
    console.error('[Google Auth Error]:', error.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// ──────────────────────────────────────────────
// GET /api/auth/keys/officers — Public keys for encryption (only approved officers)
// ──────────────────────────────────────────────
router.get('/keys/officers', async (req, res) => {
  try {
    // Only approved (non-pending) active officers/admins with uploaded public keys
    const officers = await User.find({
      role: { $in: ['officer', 'admin'] },
      active: true,
      publicKeyJwk: { $ne: null }
    }).select('email publicKeyJwk jurisdiction');
    res.json({ keys: officers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch officer keys' });
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/keys/upload — Upload officer's public key (approved officers only)
// ──────────────────────────────────────────────
router.post('/keys/upload', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  try {
    const { publicKeyJwk } = req.body;
    if (!publicKeyJwk) return res.status(400).json({ error: 'Missing publicKeyJwk' });

    req.user.publicKeyJwk = publicKeyJwk;
    await req.user.save();
    res.json({ message: 'Public key uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload public key' });
  }
});

// ──────────────────────────────────────────────
// ADMIN: GET /api/auth/admin/users — List all users
// ──────────────────────────────────────────────
router.get('/admin/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-publicKeyJwk').sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ──────────────────────────────────────────────
// ADMIN: PATCH /api/auth/admin/users/:id/approve — Approve a pending user
// ──────────────────────────────────────────────
router.patch('/admin/users/:id/approve', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { role, jurisdiction } = req.body;
    const validRoles = ['officer', 'field_team', 'ngo'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    }
    if (!jurisdiction) {
      return res.status(400).json({ error: 'Jurisdiction is required when approving an officer' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = role;
    user.jurisdiction = jurisdiction;
    user.active = true;
    await user.save();

    res.json({ message: `User ${user.email} approved as ${role} for ${jurisdiction}`, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// ──────────────────────────────────────────────
// ADMIN: PATCH /api/auth/admin/users/:id/revoke — Revoke a user
// ──────────────────────────────────────────────
router.patch('/admin/users/:id/revoke', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Cannot revoke yourself
    if (user.email === req.user.email) {
      return res.status(400).json({ error: 'Cannot revoke your own admin access' });
    }

    user.active = false;
    user.publicKeyJwk = null;  // Revoke crypto access
    await user.save();

    res.json({ message: `User ${user.email} has been revoked`, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke user' });
  }
});

// ──────────────────────────────────────────────
// GET /api/auth/me — Get current user info
// ──────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      jurisdiction: req.user.jurisdiction,
      hasPublicKey: !!req.user.publicKeyJwk
    }
  });
});

module.exports = router;
