const jwt = require('jsonwebtoken');

// Verifies the Bearer token and attaches req.userId. Any route touching
// progress/skill-confidence for a specific user should sit behind this so
// the server, not the client, decides which userId is being written to
// (per FR03/NFR04's "server-side enforcement" requirement).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

module.exports = { requireAuth };