import test from 'node:test'
import assert from 'node:assert/strict'

// Integration-style tests: import the real module (no ESM mocking just checks
// basic branching logic against the actual database).
const { resolveModelsForRequest, resolveModels } = await import('../src/utils/ai.js')

test('resolveModels exports functions', () => {
  assert.equal(typeof resolveModels, 'function')
  assert.equal(typeof resolveModelsForRequest, 'function')
})

test('resolveModelsForRequest: returns an array when modelId is null', async () => {
  const result = await resolveModelsForRequest(null)
  assert.ok(Array.isArray(result))
  // Every item should have required fields
  for (const item of result) {
    assert.ok(typeof item.id === 'string' || typeof item.id === 'number')
    assert.ok(typeof item.apiKey === 'string')
    assert.ok(typeof item.baseUrl === 'string')
    assert.ok(typeof item.model === 'string')
    assert.ok(typeof item.label === 'string')
  }
})

test('resolveModelsForRequest: returns an array when modelId is undefined', async () => {
  const result = await resolveModelsForRequest(undefined)
  assert.ok(Array.isArray(result))
})

test('resolveModelsForRequest: returns an array for a nonexistent modelId (falls back to all)', async () => {
  // Use a UUID that almost certainly doesn't exist in the database
  const result = await resolveModelsForRequest('00000000-0000-0000-0000-000000000000')
  assert.ok(Array.isArray(result))
  // Since fallback returns all models, there should be some items
  // (assuming at least one active model exists in the test database)
})

test('resolveModels: returns an array of active models', async () => {
  const result = await resolveModels()
  assert.ok(Array.isArray(result))
  for (const item of result) {
    assert.ok(typeof item.label === 'string')
    assert.ok(typeof item.apiKey === 'string')
    assert.ok(typeof item.baseUrl === 'string')
    assert.ok(typeof item.provider === 'string' || !item.provider)
  }
})

test('resolveModelsForRequest: returns items with unique IDs (no duplicates)', async () => {
  const result = await resolveModelsForRequest(null)
  assert.ok(Array.isArray(result))
  const ids = result.map((item) => item.id)
  const uniqueIds = new Set(ids)
  assert.equal(ids.length, uniqueIds.size, 'Model IDs must be unique')
})
