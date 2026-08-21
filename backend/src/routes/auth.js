const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
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
    
    if (allowedDomains.length > 0) {
      const emailDomain = email.split('@')[1];
      if (!allowedDomains.includes(emailDomain)) {
        console.warn(`Blocked unauthorized domain access attempt: ${email}`);
        return res.status(403).json({ error: 'Access denied: Unauthorized email domain' });
      }
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

module.exports = router;
