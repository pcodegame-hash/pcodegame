const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const BCRYPT_COST = 12;

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
}

// POST /api/auth/register  { email, password, displayName? }
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'email and an 8+ character password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'an account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await User.create({ email, passwordHash, displayName: displayName || '' });

    res.status(201).json({
      token: issueToken(user),
      userId: user._id.toString(),
      displayName: user.displayName
    });
  } catch (err) {
    console.error('[auth] register failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid email or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid email or password' });

    res.json({
      token: issueToken(user),
      userId: user._id.toString(),
      displayName: user.displayName
    });
  } catch (err) {
    console.error('[auth] login failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/auth/me — lets the client verify a stored token is still valid on app launch.
const { requireAuth } = require('../middleware/auth');
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('email displayName');
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ userId: user._id.toString(), email: user.email, displayName: user.displayName });
});

module.exports = router;