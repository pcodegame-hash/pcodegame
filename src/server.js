require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const progressRoutes = require('./routes/progress');
const skillConfidenceRoutes = require('./routes/skillConfidence');
const authRoutes = require('./routes/auth');
const tutorRoutes = require('./routes/tutor');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Route prefixes must match ApiConfig.baseUrl + the paths HttpProgressService /
  // HttpSkillConfidenceService build in Unity: {baseUrl}/progress/... and
  // {baseUrl}/skill-confidence/... with baseUrl defaulting to http://localhost:3000/api.
  app.use('/api/progress', progressRoutes);
  app.use('/api/skill-confidence', skillConfidenceRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/tutor', tutorRoutes);

  return app;
}

function startServer() {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error('[server] MONGODB_URI not set — copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  return mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('[server] Connected to MongoDB Atlas');
      return app.listen(PORT, () => console.log(`[server] Listening on port ${PORT}`));
    })
    .catch((err) => {
      console.error('[server] MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer };
