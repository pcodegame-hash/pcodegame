const express = require('express');
const router = express.Router();
const SkillConfidenceModel = require('../models/SkillConfidence');
const { computeConfidence, classifyTier, pushRollingScore, average } = require('../skillConfidence');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// POST /api/skill-confidence/report
// Body matches HttpSkillConfidenceService.ReportRequest: { chapterId,
// timeToSolveSeconds, expectedTimeSeconds, hintsUsed, maxHints, errorScore, firstAttemptSuccess }
router.post('/report', async (req, res) => {
  try {
    const {
      chapterId,
      timeToSolveSeconds,
      expectedTimeSeconds,
      hintsUsed,
      maxHints,
      errorScore,
      firstAttemptSuccess
    } = req.body;

    if (!chapterId) {
      return res.status(400).json({ error: 'chapterId is required' });
    }

    const attemptConfidence = computeConfidence({
      timeToSolveSeconds,
      expectedTimeSeconds,
      hintsUsed,
      maxHints,
      errorScore,
      firstAttemptSuccess
    });

    const existing = await SkillConfidenceModel.findOne({ userId: req.userId, chapterId });
    const rollingScores = pushRollingScore(existing ? existing.rollingScores : [], attemptConfidence);
    const currentConfidence = average(rollingScores);
    const currentTier = classifyTier(currentConfidence);

    const doc = await SkillConfidenceModel.findOneAndUpdate(
      { userId: req.userId, chapterId },
      { rollingScores, currentConfidence, currentTier },
      { upsert: true, new: true }
    );

    res.json({ confidence: doc.currentConfidence, tier: doc.currentTier });
  } catch (err) {
    console.error('[skill-confidence] report failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/skill-confidence/:chapterId
router.get('/:chapterId', async (req, res) => {
  try {
    const { chapterId } = req.params;
    const doc = await SkillConfidenceModel.findOne({ userId: req.userId, chapterId });
    res.json({
      confidence: doc ? doc.currentConfidence : 0,
      tier: doc ? doc.currentTier : 'NEWB'
    });
  } catch (err) {
    console.error('[skill-confidence] GET failed:', err.message);
    res.status(500).json({ confidence: 0, tier: 'NEWB' });
  }
});

module.exports = router;