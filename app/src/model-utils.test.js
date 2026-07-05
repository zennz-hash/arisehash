import { describe, it, expect } from 'vitest'
import { parseModelSelection, buildModelOptions, getModelLabel } from './model-utils.js'

describe('parseModelSelection', () => {
  it('returns nulls for falsy input', () => {
    expect(parseModelSelection(null)).toEqual({ model: null, aiKeyId: null })
    expect(parseModelSelection(undefined)).toEqual({ model: null, aiKeyId: null })
    expect(parseModelSelection('')).toEqual({ model: null, aiKeyId: null })
  })

  it('parses admin model id', () => {
    expect(parseModelSelection('gpt-4o')).toEqual({ model: 'gpt-4o', aiKeyId: null })
  })

  it('parses BYOK key', () => {
    expect(parseModelSelection('key:42')).toEqual({ model: null, aiKeyId: '42' })
  })

  it('simulates openChat reload with BYOK: aiKeyId → key: prefix → parse', () => {
    // When loading a chat from DB that has aiKeyId='abc123':
    // frontend does: setModel(`key:${chat.aiKeyId}`) → "key:abc123"
    const reconstructedModel = `key:abc123`
    const parsed = parseModelSelection(reconstructedModel)
    expect(parsed).toEqual({ model: null, aiKeyId: 'abc123' })
  })

  it('simulates openChat reload with admin model: mode → model selector → parse', () => {
    // When loading a chat from DB that has mode='gpt-4o' and no aiKeyId:
    // frontend does: setModel(chat.mode) → "gpt-4o"
    const reconstructedModel = 'gpt-4o'
    const parsed = parseModelSelection(reconstructedModel)
    expect(parsed).toEqual({ model: 'gpt-4o', aiKeyId: null })
  })

  it('simulates setChatModel switch from BYOK to admin', () => {
    // User switches dropdown from BYOK key → admin model
    // parseModelSelection("gpt-4o") → { model: "gpt-4o", aiKeyId: null }
    const parsed = parseModelSelection('gpt-4o')
    expect(parsed).toEqual({ model: 'gpt-4o', aiKeyId: null })
    // Then api.setChatModel(id, "gpt-4o", null) sends PATCH with aiKeyId: null
    // Route handler: aiKeyId !== undefined ? null : chat.aiKeyId → clears BYOK
  })

  it('simulates setChatModel switch from admin to BYOK', () => {
    // User switches dropdown from admin model → BYOK key
    // parseModelSelection("key:xyz") → { model: null, aiKeyId: "xyz" }
    const parsed = parseModelSelection('key:xyz')
    expect(parsed).toEqual({ model: null, aiKeyId: 'xyz' })
    // Then api.setChatModel(id, null, "xyz") sends PATCH with aiKeyId: "xyz"
    // Route handler: aiKeyId !== undefined ? "xyz" : chat.aiKeyId → sets BYOK
  })
})

describe('buildModelOptions', () => {
  it('returns empty array for no inputs', () => {
    expect(buildModelOptions()).toEqual([])
    expect(buildModelOptions([], [])).toEqual([])
  })

  it('builds admin model options', () => {
    const opts = buildModelOptions([{ id: 'm1', label: 'Fast', model: 'gpt-3.5' }])
    expect(opts).toHaveLength(1)
    expect(opts[0].value).toBe('m1')
    expect(opts[0].label).toBe('Fast')
    expect(opts[0].desc).toBe('gpt-3.5')
    expect(typeof opts[0].icon).toMatch(/^(function|object)$/)
  })

  it('builds BYOK options with key: prefix', () => {
    const opts = buildModelOptions([], [{ id: 'k1', label: 'My Key', provider: 'openai', model: 'gpt-4' }])
    expect(opts).toHaveLength(1)
    expect(opts[0].value).toBe('key:k1')
    expect(opts[0].label).toBe('My Key')
    expect(opts[0].desc).toBe('openai \u00b7 gpt-4')
  })

  it('orders admin models before BYOK keys', () => {
    const opts = buildModelOptions(
      [{ id: 'a', label: 'Admin', model: 'x' }],
      [{ id: 'b', label: 'BYOK', provider: 'y', model: 'z' }]
    )
    expect(opts[0].value).toBe('a')
    expect(opts[1].value).toBe('key:b')
  })
})

describe('getModelLabel', () => {
  it('returns default for empty inputs', () => {
    expect(getModelLabel(null)).toBe('Model')
    expect(getModelLabel('unknown', [], [])).toBe('Model')
  })

  it('resolves admin model label', () => {
    const admins = [{ id: 'm1', label: 'Fast' }]
    expect(getModelLabel('m1', admins, [])).toBe('Fast')
  })

  it('resolves BYOK key label', () => {
    const keys = [{ id: 'k1', label: 'My Key' }]
    expect(getModelLabel('key:k1', [], keys)).toBe('My Key')
  })

  it('falls back to BYOK for missing key', () => {
    expect(getModelLabel('key:missing', [], [])).toBe('BYOK')
  })
})
