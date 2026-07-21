const mongoose = require('mongoose');

/// One document per (userId, chapterId) pair — mirrors the RollingConfidenceTracker
/// in Unity's SkillConfidence.cs. rollingScores holds at most the last 5 attempt
/// confidences (see src/skillConfidence.js pushRollingScore), and currentConfidence/
/// currentTier are the derived values Unity actually reads on GET.
const skillConfidenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    chapterId: { type: String, required: true, index: true },
    rollingScores: { type: [Number], default: [] },
    currentConfidence: { type: Number, default: 0 },
    currentTier: {
      type: String,
      enum: ['NEWB', 'AMATEUR', 'PROGRAMMER', 'PROGAMER'],
      default: 'NEWB'
    }
  },
  { timestamps: true }
);

skillConfidenceSchema.index({ userId: 1, chapterId: 1 }, { unique: true });

module.exports = mongoose.model('SkillConfidence', skillConfidenceSchema);
