const express = require('express');
const router = express.Router();
const Progress = require('../models/Progress');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/progress
// userId now comes from the verified JWT (req.userId), not the URL.
router.get('/', async (req, res) => {
  try {
    const doc = await Progress.findOne({ userId: req.userId });
    res.json({ completedLevelIds: doc ? doc.completedLevelIds : [] });
  } catch (err) {
    console.error('[progress] GET failed:', err.message);
    res.status(500).json({ completedLevelIds: [] });
  }
});

// POST /api/progress/level-complete
// Body matches HttpProgressService.LevelCompleteRequest: { levelId, xpAwarded }
// (userId removed from the body — it's derived from the token instead)
router.post('/level-complete', async (req, res) => {
  try {
    const { levelId, xpAwarded } = req.body;
    if (!levelId) {
      return res.status(400).json({ error: 'levelId is required' });
    }

    const doc = await Progress.findOneAndUpdate(
      { userId: req.userId },
      {
        $addToSet: { completedLevelIds: levelId },
        $inc: { xpTotal: xpAwarded || 0 }
      },
      { upsert: true, new: true }
    );

    res.json({ completedLevelIds: doc.completedLevelIds, xpTotal: doc.xpTotal });
  } catch (err) {
    console.error('[progress] level-complete failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// POST /api/progress/puzzle-solved
// Body matches HttpProgressService.PuzzleSolvedRequest: { levelId, puzzleId, attemptCount }
router.post('/puzzle-solved', async (req, res) => {
  try {
    const { levelId, puzzleId, attemptCount } = req.body;
    if (!levelId || !puzzleId) {
      return res.status(400).json({ error: 'levelId and puzzleId are required' });
    }

    await Progress.findOneAndUpdate(
      { userId: req.userId },
      { $push: { puzzleAttempts: { levelId, puzzleId, attemptCount: attemptCount || 0 } } },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[progress] puzzle-solved failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;