const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

/**
 * @route POST /api/auth/google
 * @desc Authenticates a nodal officer using Google OAuth2 and issues a JWT session token.
 * @access Public (Requires valid @iiitnr.edu.in email domain)
 */
const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    console.log('[Auth] /google hit! Credential received.');
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }

    // Verify the Google JWT token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    // Optional: Restrict to specific domains
    const allowedDomains = process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [];
    
    // DISABLED DOMAIN CHECK FOR HACKATHON DEMO:
    // if (allowedDomains.length > 0) {
    //   const emailDomain = email.split('@')[1];
    //   if (!allowedDomains.includes(emailDomain)) {
    //     console.warn(`Blocked unauthorized domain access attempt: ${email}`);
    //     return res.status(403).json({ error: 'Access denied: Unauthorized email domain' });
    //   }
    // }

    // Sync user with database
    const User = require('../models/User');
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: payload.name,
        role: 'officer' // default role for newly onboarded google auth
      });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    // Create a secure session token
    const sessionToken = jwt.sign(
      { email, name: payload.name }, 
      process.env.JWT_SECRET || 'fallback_secret_for_dev',
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Authentication successful',
      token: sessionToken,
      user: {
        name: payload.name,
        email: payload.email,
        picture: payload.picture
      }
    });
  } catch (error) {
    console.error('[Google Auth Error]:', error.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// GET /api/auth/keys/officers
router.get('/keys/officers', async (req, res) => {
  try {
    const User = require('../models/User');
    const officers = await User.find({ role: { $in: ['officer', 'admin'] }, active: true, publicKeyJwk: { $ne: null } })
                               .select('email publicKeyJwk');
    res.json({ keys: officers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// POST /api/auth/keys/upload
const { requireAuth } = require('../middleware/authMiddleware');
router.post('/keys/upload', requireAuth, async (req, res) => {
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

router.post('/dev-bypass', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'DEV_AUTH_BYPASS not allowed in production' });
  }
  
  if (process.env.DEV_AUTH_BYPASS !== 'true') {
    return res.status(403).json({ error: 'DEV_AUTH_BYPASS is disabled' });
  }
  
  const email = 'demo_officer@example.com';
  let user = await require('../models/User').findOne({ email });
  if (!user) {
    user = await require('../models/User').create({
      email,
      name: 'Demo Officer',
      role: 'officer'
    });
  }

  const sessionToken = jwt.sign(
    { email: user.email, name: user.name }, 
    process.env.JWT_SECRET || 'fallback_secret_for_dev',
    { expiresIn: '8h' }
  );

  res.json({
    message: 'Dev bypass successful',
    token: sessionToken,
    user: {
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

module.exports = router;
