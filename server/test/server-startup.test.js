import test from 'node:test'
import assert from 'node:assert/strict'

test('server app imports in serverless mode', async () => {
  const originalEnv = {
    VERCEL: process.env.VERCEL,
    JWT_SECRET: process.env.JWT_SECRET,
    AI_KEY_SECRET: process.env.AI_KEY_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  }

  process.env.VERCEL = '1'
  process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters'
  process.env.AI_KEY_SECRET = 'test-ai-key-secret-with-at-least-32-characters'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/test'
  process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL

  try {
    const mod = await import(`../src/index.js?startup=${Date.now()}`)
    assert.equal(typeof mod.default, 'function')
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
