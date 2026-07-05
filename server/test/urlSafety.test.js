import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAiBaseUrl } from '../src/utils/urlSafety.js'

test('normalizeAiBaseUrl accepts normal OpenAI-compatible HTTPS URLs', () => {
  assert.equal(
    normalizeAiBaseUrl('https://api.openai.com/v1/'),
    'https://api.openai.com/v1'
  )
})

test('normalizeAiBaseUrl strips query and hash fragments', () => {
  assert.equal(
    normalizeAiBaseUrl('https://openrouter.ai/api/v1/?x=1#frag'),
    'https://openrouter.ai/api/v1'
  )
})

test('normalizeAiBaseUrl blocks localhost and private IP hosts', () => {
  assert.throws(() => normalizeAiBaseUrl('http://localhost:11434/v1'), /lokal\/private/)
  assert.throws(() => normalizeAiBaseUrl('http://127.0.0.1:11434/v1'), /lokal\/private|IP private/)
  assert.throws(() => normalizeAiBaseUrl('http://192.168.1.20/v1'), /IP private/)
  assert.throws(() => normalizeAiBaseUrl('http://10.0.0.2/v1'), /IP private/)
})

test('normalizeAiBaseUrl requires HTTPS in production', () => {
  assert.throws(
    () => normalizeAiBaseUrl('http://api.example.com/v1', { isProd: true }),
    /HTTPS/
  )
})
