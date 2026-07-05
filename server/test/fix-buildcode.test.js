/**
 * Integration test untuk memverifikasi perbaikan Build Code
 * (upload file .md, attachment handling, schema aiKeyId)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCodeProjectSchema,
  streamCodeProjectSchema
} from '../src/schemas/codeProject.schema.js'

// ── Test 1: Schema createCodeProjectSchema ──
test('createCodeProjectSchema menerima aiKeyId valid', () => {
  const result = createCodeProjectSchema.safeParse({
    name: 'Test Project',
    template: 'react',
    model: 'model-1',
    aiKeyId: 'key-abc-123'
  })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, 'key-abc-123')
})

test('createCodeProjectSchema menerima template other dari dropdown Build Code', () => {
  const result = createCodeProjectSchema.safeParse({
    name: 'Custom Stack',
    template: 'other'
  })
  assert.equal(result.success, true)
})

test('createCodeProjectSchema menolak aiKeyId > 50 karakter', () => {
  const result = createCodeProjectSchema.safeParse({ aiKeyId: 'x'.repeat(51) })
  assert.equal(result.success, false)
})

test('createCodeProjectSchema aiKeyId opsional (null diabaikan)', () => {
  const result = createCodeProjectSchema.safeParse({ name: 'Test' })
  assert.equal(result.success, true)
  assert.equal(result.data.aiKeyId, undefined)
})

// ── Test 2: Schema streamCodeProjectSchema ──
test('streamCodeProjectSchema menerima instruction + attachment .md', () => {
  const result = streamCodeProjectSchema.safeParse({
    instruction: 'Buat aplikasi dari file ini',
    attachments: [
      { type: 'text', name: 'README.md', content: '# Test App\n\nFile markdown.' }
    ]
  })
  assert.equal(result.success, true)
  assert.equal(result.data.attachments[0].type, 'text')
  assert.equal(result.data.attachments[0].name, 'README.md')
})

test('streamCodeProjectSchema menerima multiple attachments (text + image)', () => {
  const result = streamCodeProjectSchema.safeParse({
    instruction: 'Buat dari referensi',
    attachments: [
      { type: 'text', name: 'spec.md', content: '# Spesifikasi' },
      { type: 'image', name: 'wireframe.png', dataUrl: 'data:image/png;base64,iVBOR' }
    ]
  })
  assert.equal(result.success, true)
})

test('streamCodeProjectSchema menerima konten attachment besar (10KB)', () => {
  const result = streamCodeProjectSchema.safeParse({
    instruction: 'Test',
    attachments: [
      { type: 'text', name: 'big.md', content: 'x'.repeat(10000) }
    ]
  })
  assert.equal(result.success, true)
  assert.equal(result.data.attachments[0].content.length, 10000)
})

test('streamCodeProjectSchema menolak tipe attachment tidak valid', () => {
  const result = streamCodeProjectSchema.safeParse({
    instruction: 'Test',
    attachments: [
      { type: 'pdf', name: 'doc.pdf', content: 'blah' }
    ]
  })
  assert.equal(result.success, false)
})
