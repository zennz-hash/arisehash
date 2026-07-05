import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'

import { googleLoginSchema, updateProfileSchema } from '../src/schemas/auth.schema.js'
import {
  generateQuestionsSchema,
  generateBlueprintSchema,
  updateBlueprintSchema,
  reviseBlueprintSchema,
  restoreVersionSchema,
  shareBlueprintSchema
} from '../src/schemas/blueprint.schema.js'
import { createChatSchema, updateChatSchema, sendMessageSchema } from '../src/schemas/chat.schema.js'
import { createAiKeySchema, updateAiKeySchema } from '../src/schemas/aiKey.schema.js'
import { updateSubscriptionSchema } from '../src/schemas/admin.schema.js'
import {
  createCodeProjectSchema,
  shareCodeProjectSchema,
  addCollaboratorSchema,
  streamCodeProjectSchema
} from '../src/schemas/codeProject.schema.js'

// --- Auth schemas ---

test('googleLoginSchema accepts valid credential', () => {
  const result = googleLoginSchema.safeParse({ credential: 'eyJhbGciOiJSUzI1NiJ9.test' })
  assert.equal(result.success, true)
})

test('googleLoginSchema rejects empty credential', () => {
  const result = googleLoginSchema.safeParse({ credential: '' })
  assert.equal(result.success, false)
})

test('googleLoginSchema rejects missing credential', () => {
  const result = googleLoginSchema.safeParse({})
  assert.equal(result.success, false)
})

test('updateProfileSchema accepts valid name', () => {
  const result = updateProfileSchema.safeParse({ name: 'John Doe' })
  assert.equal(result.success, true)
  assert.equal(result.data.name, 'John Doe')
})

test('updateProfileSchema rejects empty name', () => {
  const result = updateProfileSchema.safeParse({ name: '   ' })
  assert.equal(result.success, false)
})

test('updateProfileSchema rejects name over 80 chars', () => {
  const result = updateProfileSchema.safeParse({ name: 'a'.repeat(81) })
  assert.equal(result.success, false)
})

// --- Blueprint schemas ---

test('generateQuestionsSchema accepts valid input', () => {
  const result = generateQuestionsSchema.safeParse({ idea: 'E-commerce app', template: 'saas' })
  assert.equal(result.success, true)
})

test('generateQuestionsSchema rejects missing idea', () => {
  const result = generateQuestionsSchema.safeParse({ template: 'saas' })
  assert.equal(result.success, false)
})

test('generateBlueprintSchema accepts valid input with optional fields', () => {
  const result = generateBlueprintSchema.safeParse({
    idea: 'AI chatbot',
    template: 'saas',
    model: 'gpt-4',
    techMode: 'auto',
    quizAnswers: [{ id: 1, answer: 'Yes' }]
  })
  assert.equal(result.success, true)
  assert.equal(result.data.model, 'gpt-4')
})

test('generateBlueprintSchema accepts any model string', () => {
  const result = generateBlueprintSchema.safeParse({
    idea: 'test',
    template: 'test',
    model: 'any-model-name'
  })
  assert.equal(result.success, true)
})

test('updateBlueprintSchema accepts partial update', () => {
  const result = updateBlueprintSchema.safeParse({ name: 'Updated Name' })
  assert.equal(result.success, true)
})

test('updateBlueprintSchema rejects empty object', () => {
  const result = updateBlueprintSchema.safeParse({})
  assert.equal(result.success, false)
})

test('reviseBlueprintSchema accepts valid instruction', () => {
  const result = reviseBlueprintSchema.safeParse({ instruction: 'Add auth section' })
  assert.equal(result.success, true)
})

test('reviseBlueprintSchema keeps selected model and aiKeyId', () => {
  const result = reviseBlueprintSchema.safeParse({
    instruction: 'Add auth section',
    model: 'model-1',
    aiKeyId: 'key-1'
  })
  assert.equal(result.success, true)
  assert.equal(result.data.model, 'model-1')
  assert.equal(result.data.aiKeyId, 'key-1')
})

test('reviseBlueprintSchema rejects empty instruction', () => {
  const result = reviseBlueprintSchema.safeParse({ instruction: '   ' })
  assert.equal(result.success, false)
})

test('restoreVersionSchema accepts number', () => {
  const result = restoreVersionSchema.safeParse({ versionNumber: 3 })
  assert.equal(result.success, true)
})

test('restoreVersionSchema accepts numeric string', () => {
  const result = restoreVersionSchema.safeParse({ versionNumber: '5' })
  assert.equal(result.success, true)
  assert.equal(result.data.versionNumber, 5)
})

test('shareBlueprintSchema accepts valid input', () => {
  const result = shareBlueprintSchema.safeParse({ isPublic: true })
  assert.equal(result.success, true)
})

test('shareBlueprintSchema rejects non-boolean', () => {
  const result = shareBlueprintSchema.safeParse({ isPublic: 'yes' })
  assert.equal(result.success, false)
})

// --- Chat schemas ---

test('createChatSchema accepts empty body (model optional)', () => {
  const result = createChatSchema.safeParse({})
  assert.equal(result.success, true)
})

test('createChatSchema accepts valid model string', () => {
  const result = createChatSchema.safeParse({ model: 'gpt-4o' })
  assert.equal(result.success, true)
})

test('createChatSchema rejects model over max length', () => {
  const result = createChatSchema.safeParse({ model: 'x'.repeat(101) })
  assert.equal(result.success, false)
})

test('createChatSchema accepts aiKeyId', () => {
  const result = createChatSchema.safeParse({ model: 'gpt-4o', aiKeyId: 'key-123' })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'key-123')
})

test('createChatSchema rejects aiKeyId over max length', () => {
  const result = createChatSchema.safeParse({ aiKeyId: 'x'.repeat(51) })
  assert.equal(result.success, false)
})

test('updateChatSchema accepts title', () => {
  const result = updateChatSchema.safeParse({ title: 'New Title' })
  assert.equal(result.success, true)
})

test('updateChatSchema accepts aiKeyId', () => {
  const result = updateChatSchema.safeParse({ model: 'gpt-4o', aiKeyId: 'key-456' })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'key-456')
})

test('updateChatSchema accepts null aiKeyId (clear BYOK)', () => {
  const result = updateChatSchema.safeParse({ aiKeyId: null })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, null)
})

test('updateChatSchema without aiKeyId keeps existing (undefined)', () => {
  const result = updateChatSchema.safeParse({ title: 'Rename only' })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, undefined)
})

test('sendMessageSchema accepts valid content', () => {
  const result = sendMessageSchema.safeParse({ content: 'Hello!' })
  assert.equal(result.success, true)
})

test('sendMessageSchema rejects empty content', () => {
  const result = sendMessageSchema.safeParse({ content: '   ' })
  assert.equal(result.success, false)
})

// --- AI Key schemas ---

test('createAiKeySchema accepts valid input', () => {
  const result = createAiKeySchema.safeParse({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test123',
    model: 'gpt-4'
  })
  assert.equal(result.success, true)
})

test('createAiKeySchema rejects invalid URL', () => {
  const result = createAiKeySchema.safeParse({
    baseUrl: 'not-a-url',
    apiKey: 'sk-test',
    model: 'gpt-4'
  })
  assert.equal(result.success, false)
})

test('createAiKeySchema rejects missing required fields', () => {
  const result = createAiKeySchema.safeParse({ baseUrl: 'https://api.openai.com/v1' })
  assert.equal(result.success, false)
})

test('updateAiKeySchema accepts partial update', () => {
  const result = updateAiKeySchema.safeParse({ label: 'My Model' })
  assert.equal(result.success, true)
})

test('updateAiKeySchema rejects empty object', () => {
  const result = updateAiKeySchema.safeParse({})
  assert.equal(result.success, false)
})

// --- Admin schemas ---

test('updateSubscriptionSchema accepts valid plan types', () => {
  for (const planType of ['FREE', 'PRO', 'PRO_MAX']) {
    const result = updateSubscriptionSchema.safeParse({ planType })
    assert.equal(result.success, true, `Expected ${planType} to be valid`)
  }
})

test('updateSubscriptionSchema rejects invalid plan type', () => {
  const result = updateSubscriptionSchema.safeParse({ planType: 'ENTERPRISE' })
  assert.equal(result.success, false)
})

// --- Code Project schemas ---

test('createCodeProjectSchema accepts empty body (all optional)', () => {
  const result = createCodeProjectSchema.safeParse({})
  assert.equal(result.success, true)
})

test('createCodeProjectSchema accepts valid template', () => {
  const result = createCodeProjectSchema.safeParse({ name: 'My Project', template: 'react' })
  assert.equal(result.success, true)
})

test('createCodeProjectSchema accepts custom other template from Build Code UI', () => {
  const result = createCodeProjectSchema.safeParse({ name: 'Custom Project', template: 'other' })
  assert.equal(result.success, true)
})

test('createCodeProjectSchema accepts aiKeyId', () => {
  const result = createCodeProjectSchema.safeParse({ name: 'My Project', template: 'react', model: 'model-1', aiKeyId: 'key-123' })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'key-123')
})

test('createCodeProjectSchema rejects aiKeyId over max length', () => {
  const result = createCodeProjectSchema.safeParse({ aiKeyId: 'x'.repeat(51) })
  assert.equal(result.success, false)
})

test('createCodeProjectSchema rejects invalid template', () => {
  const result = createCodeProjectSchema.safeParse({ template: 'angular' })
  assert.equal(result.success, false)
})

test('shareCodeProjectSchema accepts valid input', () => {
  const result = shareCodeProjectSchema.safeParse({ isPublic: true, expiresInDays: 7, allowDownload: true })
  assert.equal(result.success, true)
  assert.equal(result.data.expiresInDays, 7)
})

test('shareCodeProjectSchema rejects expiresInDays > 365', () => {
  const result = shareCodeProjectSchema.safeParse({ isPublic: true, expiresInDays: 400 })
  assert.equal(result.success, false)
})

test('addCollaboratorSchema accepts valid email', () => {
  const result = addCollaboratorSchema.safeParse({ email: 'user@example.com', role: 'EDITOR' })
  assert.equal(result.success, true)
  assert.equal(result.data.email, 'user@example.com')
})

test('addCollaboratorSchema rejects invalid email', () => {
  const result = addCollaboratorSchema.safeParse({ email: 'not-an-email' })
  assert.equal(result.success, false)
})

test('streamCodeProjectSchema accepts valid instruction', () => {
  const result = streamCodeProjectSchema.safeParse({ instruction: 'Add a login page' })
  assert.equal(result.success, true)
})

test('streamCodeProjectSchema rejects empty instruction', () => {
  const result = streamCodeProjectSchema.safeParse({ instruction: '' })
  assert.equal(result.success, false)
})
