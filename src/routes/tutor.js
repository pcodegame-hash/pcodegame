const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const LevelDialogueCache = require('../models/LevelDialogueCache');

const MODEL = 'gemini-3.5-flash';
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Forces the model's output to conform to this exact shape at generation time,
// rather than relying on prompt instructions alone — much more reliable than
// responseMimeType by itself, and the main fix for parse failures after a model swap.
const DIALOGUE_LINES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      text: { type: 'STRING' }
    },
    required: ['id', 'text']
  }
};

async function callGeminiWithBackoff(body, apiKey, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get('retry-after')) || 2 ** attempt;
      console.warn(`[tutor] 429 from Gemini — retrying in ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    return response;
  }
}

// Handles: clean JSON array, ```-fenced JSON, JSON wrapped in a { "lines": [...] } /
// { "dialogue": [...] } object (some models nest even when asked for a bare array),
// and truncated JSON (best-effort — logs a specific warning so you know to raise
// maxOutputTokens rather than debug the parser further).
function extractJsonArray(rawText, finishReason) {
  if (!rawText) return { lines: null, reason: 'empty response' };

  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    if (finishReason === 'MAX_TOKENS') {
      return { lines: null, reason: 'response was truncated (hit maxOutputTokens) — raise the token limit' };
    }
    return { lines: null, reason: `JSON.parse failed: ${err.message}` };
  }

  if (Array.isArray(parsed)) return { lines: parsed, reason: null };
  if (Array.isArray(parsed.lines)) return { lines: parsed.lines, reason: null };
  if (Array.isArray(parsed.dialogue)) return { lines: parsed.dialogue, reason: null };

  return { lines: null, reason: 'parsed JSON but found no array at top level or under "lines"/"dialogue"' };
}

// POST /api/tutor/generate-level-dialogue
// Body: { tutorCharacterId, levelId, prompt }
// One Gemini call returns every narrative line this level needs, as JSON.
// Cached per (tutorCharacterId, levelId) — after the first ever load of a
// given level, no further Gemini calls happen for it, from anyone.
router.post('/generate-level-dialogue', requireAuth, async (req, res) => {
  try {
    const { tutorCharacterId, levelId, prompt } = req.body;
    if (!tutorCharacterId || !levelId || !prompt) {
      return res.status(400).json({ error: 'tutorCharacterId, levelId, and prompt are required' });
    }

    const cached = await LevelDialogueCache.findOne({ tutorCharacterId, levelId });
    if (cached) return res.json({ lines: cached.lines, cached: true });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured server-side' });

    const response = await callGeminiWithBackoff(
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1500, // raised — schema-constrained output plus ~8-10 lines needs headroom
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: DIALOGUE_LINES_SCHEMA
        }
      },
      apiKey
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[tutor] Gemini request failed:', response.status, errorBody);
      return res.status(502).json({ error: 'upstream LLM error' });
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text;
    const finishReason = candidate?.finishReason;

    const { lines, reason } = extractJsonArray(rawText, finishReason);

    if (!lines) {
      console.error(`[tutor] Could not parse JSON dialogue array from Gemini response — ${reason}`);
      console.error('[tutor] finishReason:', finishReason);
      console.error('[tutor] raw text was:', rawText);
      return res.status(502).json({ error: 'malformed dialogue response from LLM' });
    }

    const validLines = lines.filter((l) => l && typeof l.id === 'string' && typeof l.text === 'string');

    if (validLines.length === 0) {
      console.error('[tutor] Parsed an array but no entries had valid {id, text} shape:', lines);
      return res.status(502).json({ error: 'malformed dialogue response from LLM' });
    }

    await LevelDialogueCache.findOneAndUpdate(
      { tutorCharacterId, levelId },
      { lines: validLines },
      { upsert: true }
    );

    res.json({ lines: validLines, cached: false });
  } catch (err) {
    console.error('[tutor] generate-level-dialogue failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// POST /api/tutor/generate  { prompt }
// Still used for hints only — per-attempt, not cacheable the same way, kept small.
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured server-side' });

    const response = await callGeminiWithBackoff(
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 120, temperature: 0.9 } },
      apiKey
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[tutor] Gemini request failed:', response.status, errorBody);
      return res.status(502).json({ error: 'upstream LLM error' });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    res.json({ text });
  } catch (err) {
    console.error('[tutor] generate failed:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;