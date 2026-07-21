const mongoose = require('mongoose');

/// One document per userId. completedLevelIds matches what
/// Unity's HttpProgressService.GetCompletedLevelIdsAsync expects back
/// (a flat array of LevelData.levelId strings, e.g. "ch1_lvl3").
const puzzleAttemptSchema = new mongoose.Schema(
  {
    levelId: { type: String, required: true },
    puzzleId: { type: String, required: true },
    attemptCount: { type: Number, default: 0 },
    solvedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    completedLevelIds: { type: [String], default: [] },
    xpTotal: { type: Number, default: 0 },
    puzzleAttempts: { type: [puzzleAttemptSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Progress', progressSchema);
