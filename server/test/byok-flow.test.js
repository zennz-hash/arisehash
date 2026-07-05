import test from 'node:test'
import assert from 'node:assert/strict'
import { createChatSchema, updateChatSchema, sendMessageSchema } from '../src/schemas/chat.schema.js'
import { createCodeProjectSchema } from '../src/schemas/codeProject.schema.js'
import { generateQuestionsSchema, generateBlueprintSchema } from '../src/schemas/blueprint.schema.js'

// ── BYOK Flow: Create Chat ────────────────────────────────────────────────

test('BYOK: createChat with aiKeyId persists through schema', () => {
  // Simulates frontend: parseModelSelection("key:abc123") → { model: null, aiKeyId: "abc123" }
  const body = { model: null, aiKeyId: 'abc123' }
  const result = createChatSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.model, null)
  assert.equal(result.data.aiKeyId, 'abc123')
})

test('BYOK: createChat without aiKeyId (admin model)', () => {
  // Simulates frontend: parseModelSelection("gpt-4o") → { model: "gpt-4o", aiKeyId: null }
  const body = { model: 'gpt-4o', aiKeyId: null }
  const result = createChatSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.model, 'gpt-4o')
  assert.equal(result.data.aiKeyId, null)
})

test('BYOK: createChat with both model and aiKeyId (should not happen, but non-breaking)', () => {
  const result = createChatSchema.safeParse({ model: 'gpt-4o', aiKeyId: 'abc123' })
  assert.equal(result.success, true)
  assert.equal(result.data.model, 'gpt-4o')
  assert.equal(result.data.aiKeyId, 'abc123')
})

// ── BYOK Flow: Update Chat (PATCH) ────────────────────────────────────────

test('BYOK: updateChat set aiKeyId (switch to BYOK from admin)', () => {
  // Simulates: frontend sends { model: null, aiKeyId: "key-789" } via setChatModel
  const body = { model: null, aiKeyId: 'key-789' }
  const result = updateChatSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.model, null)
  assert.equal(result.data.aiKeyId, 'key-789')
})

test('BYOK: updateChat clear aiKeyId with null (switch from BYOK back to admin)', () => {
  // Simulates: frontend sends { model: "gpt-4o", aiKeyId: null } via setChatModel
  const body = { model: 'gpt-4o', aiKeyId: null }
  const result = updateChatSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.model, 'gpt-4o')
  assert.equal(result.data.aiKeyId, null)
})

test('BYOK: updateChat without aiKeyId keeps existing (rename only)', () => {
  // Simulates frontend: api.renameChat(id, title) → { title: "New Title" }
  const body = { title: 'New Title' }
  const result = updateChatSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.title, 'New Title')
  // aiKeyId is undefined (not in body), route must preserve existing value
  assert.equal(result.data.aiKeyId, undefined)
})

// ── BYOK Flow: Send Message ───────────────────────────────────────────────

test('BYOK: sendMessage with aiKeyId', () => {
  // Simulates: frontend send() sends { content, model: null, aiKeyId: "abc123" }
  const body = { content: 'Hello', model: null, aiKeyId: 'abc123' }
  const result = sendMessageSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'abc123')
  assert.equal(result.data.model, null)
})

test('BYOK: sendMessage without aiKeyId or model (fallback to chat.mode)', () => {
  const body = { content: 'Hello' }
  const result = sendMessageSchema.safeParse(body)
  assert.equal(result.success, true)
  // Route handler falls back to chat.mode when both are null/undefined
  assert.equal(result.data.aiKeyId, undefined)
  assert.equal(result.data.model, undefined)
})

// ── BYOK Flow: Create Code Project ────────────────────────────────────────

test('BYOK: createCodeProject with aiKeyId', () => {
  // Simulates: buildCode() → parseModelSelection(model) → createCodeProject(name, null, null, payloadModel, payloadAiKeyId)
  const body = { name: 'From Chat', blueprintId: null, template: null, model: null, aiKeyId: 'abc123' }
  const result = createCodeProjectSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'abc123')
  assert.equal(result.data.model, null)
})

test('BYOK: createCodeProject with admin model (no aiKeyId)', () => {
  const body = { name: 'My Project', template: 'react', model: 'model-1', aiKeyId: null }
  const result = createCodeProjectSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, null)
  assert.equal(result.data.model, 'model-1')
})

// ── BYOK Flow: Blueprint Questions ─────────────────────────────────────────

test('BYOK: generateQuestions with aiKeyId', () => {
  const body = { idea: 'Todo app', template: 'saas', model: null, aiKeyId: 'abc123' }
  const result = generateQuestionsSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'abc123')
})

test('BYOK: generateBlueprint with aiKeyId', () => {
  const body = { idea: 'Chat app', template: 'saas', model: null, aiKeyId: 'abc123', quizAnswers: [] }
  const result = generateBlueprintSchema.safeParse(body)
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'abc123')
})

// ── Route Logic Simulation: aiKeyId !== undefined check ────────────────────

test('BYOK: route logic — aiKeyId !== undefined preserves existing', () => {
  // Simulates: PATCH route: aiKeyId: aiKeyId !== undefined ? aiKeyId : chat.aiKeyId
  // Case 1: aiKeyId not sent → keep existing
  const bodyNoAiKey = {}
  const { aiKeyId } = bodyNoAiKey
  assert.equal(aiKeyId, undefined)
  // When aiKeyId is undefined, route keeps chat.aiKeyId
  const kept = aiKeyId !== undefined ? 'SHOULD_NOT_HAPPEN' : 'PRESERVED_EXISTING'
  assert.equal(kept, 'PRESERVED_EXISTING')

  // Case 2: aiKeyId sent as null → clear it
  const bodyNullAiKey = { model: 'gpt-4o', aiKeyId: null }
  const { aiKeyId: nullAiKey } = bodyNullAiKey
  assert.equal(nullAiKey, null)
  const cleared = nullAiKey !== undefined ? nullAiKey : 'SHOULD_NOT_HAPPEN'
  assert.equal(cleared, null)

  // Case 3: aiKeyId sent as string → update it
  const bodyWithAiKey = { model: null, aiKeyId: 'new-key' }
  const { aiKeyId: newAiKey } = bodyWithAiKey
  assert.equal(newAiKey, 'new-key')
  const updated = newAiKey !== undefined ? newAiKey : 'SHOULD_NOT_HAPPEN'
  assert.equal(updated, 'new-key')
})
