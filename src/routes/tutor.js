const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

const MODEL = 'gemini-2.0-flash';
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// POST /api/tutor/generate  { prompt }
// Body/response shape is intentionally minimal — Unity's GeminiClient just needs
// { text } back. Key never leaves the server.
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured server-side' });

    const response = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.9 }
      })
    });

    if (!response.ok) {
      console.error('[tutor] Gemini request failed:', response.status);
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