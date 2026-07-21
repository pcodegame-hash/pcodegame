const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApp } = require('../src/server');

test('POST /api/auth/register returns 400 for incomplete payload', async () => {
  const app = createApp();
  const server = app.listen(0);

  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'demo@example.com' })
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /password/i);
  } finally {
    server.close();
  }
});
