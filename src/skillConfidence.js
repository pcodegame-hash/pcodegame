// Server-side mirror of Unity's SkillConfidenceCalculator (see SkillConfidence.cs).
// Kept numerically identical on purpose — if these two ever drift, the local session
// mirror in HttpSkillConfidenceService.cs (used when the API is unreachable) will
// silently disagree with what the server computes once connectivity returns.

const WEIGHTS = { time: 0.2, hint: 0.3, error: 0.3, firstAttempt: 0.2 };
const WINDOW_SIZE = 5;

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

// 1.0 if solved at/under expected time, decays linearly to 0 at 2x expected time.
function computeTimeFactor(actualSeconds, expectedSeconds) {
  if (!expectedSeconds || expectedSeconds <= 0) return 1; // no baseline configured — don't penalize
  if (actualSeconds <= expectedSeconds) return 1;

  const ratio = actualSeconds / expectedSeconds; // > 1
  return clamp01(1 - (ratio - 1));
}

function computeHintRate(hintsUsed, maxHints) {
  const denom = maxHints > 1 ? maxHints : 1;
  return clamp01((hintsUsed || 0) / denom);
}

function computeConfidence({
  timeToSolveSeconds,
  expectedTimeSeconds,
  hintsUsed,
  maxHints,
  errorScore,
  firstAttemptSuccess
}) {
  const timeFactor = computeTimeFactor(timeToSolveSeconds, expectedTimeSeconds);
  const hintRate = computeHintRate(hintsUsed, maxHints);
  const err = clamp01(errorScore || 0);
  const first = firstAttemptSuccess ? 1 : 0;

  const confidence =
    WEIGHTS.time * timeFactor +
    WEIGHTS.hint * (1 - hintRate) +
    WEIGHTS.error * (1 - err) +
    WEIGHTS.firstAttempt * first;

  return clamp01(confidence);
}

function classifyTier(confidence) {
  if (confidence <= 0.25) return 'NEWB';
  if (confidence <= 0.55) return 'AMATEUR';
  if (confidence <= 0.8) return 'PROGRAMMER';
  return 'PROGAMER';
}

// Appends a new score and trims to the last WINDOW_SIZE entries, matching
// RollingConfidenceTracker's "last 5 completions" rule from the FYP report.
function pushRollingScore(existingScores, newScore) {
  const updated = [...(existingScores || []), newScore];
  while (updated.length > WINDOW_SIZE) updated.shift();
  return updated;
}

function average(scores) {
  if (!scores || scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

module.exports = { computeConfidence, classifyTier, pushRollingScore, average, WINDOW_SIZE };
