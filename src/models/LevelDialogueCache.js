const mongoose = require('mongoose');

// One doc per (tutorCharacterId, levelId) — the entire set of narrative lines
// for that level, generated in a single Gemini call and cached forever after.
const lineSchema = new mongoose.Schema(
  { id: { type: String, required: true }, text: { type: String, required: true } },
  { _id: false }
);

const levelDialogueCacheSchema = new mongoose.Schema(
  {
    tutorCharacterId: { type: String, required: true, index: true },
    levelId: { type: String, required: true, index: true },
    lines: { type: [lineSchema], default: [] }
  },
  { timestamps: true }
);

levelDialogueCacheSchema.index({ tutorCharacterId: 1, levelId: 1 }, { unique: true });

module.exports = mongoose.model('LevelDialogueCache', levelDialogueCacheSchema);