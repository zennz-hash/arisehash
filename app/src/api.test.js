import { describe, it, expect, vi } from 'vitest'
import { getCsrfToken, authHeaders, api } from './api.js'

// Reusable fetch mock helper
function mockFetch(response) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
    status: 200,
  })
}

describe('api.createChat', () => {
  it('sends model and aiKeyId in body', async () => {
    mockFetch({ id: 'c1', model: 'm1' })
    await api.createChat('m1', 'k1')
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe('m1')
    expect(body.aiKeyId).toBe('k1')
  })

  it('works with null values', async () => {
    mockFetch({ id: 'c2', model: null })
    await api.createChat(null, null)
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBeNull()
    expect(body.aiKeyId).toBeNull()
  })
})

describe('api.setChatModel', () => {
  it('patches model and aiKeyId', async () => {
    mockFetch({ ok: true })
    await api.setChatModel('c1', 'm2', 'k2')
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe('m2')
    expect(body.aiKeyId).toBe('k2')
  })

  it('clears aiKeyId with null (switch from BYOK to admin model)', async () => {
    mockFetch({ ok: true })
    await api.setChatModel('c1', 'gpt-4o', null)
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe('gpt-4o')
    expect(body.aiKeyId).toBeNull()
  })
})

describe('api.createCodeProject', () => {
  it('sends model and aiKeyId', async () => {
    mockFetch({ id: 'p1', name: 'Test' })
    await api.createCodeProject('Test', null, 'react', 'm1', 'k1')
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe('m1')
    expect(body.aiKeyId).toBe('k1')
  })
})

describe('api.saveCodeProject', () => {
  it('can save messages without overwriting files', async () => {
    mockFetch({ id: 'p1', messagesJson: '[]' })
    await api.saveCodeProject('p1', undefined, '[]', 'Test')
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.filesJson).toBeUndefined()
    expect(body.messagesJson).toBe('[]')
  })
})

describe('api.generateQuestions', () => {
  it('sends idea, template, model and aiKeyId', async () => {
    mockFetch([{ id: 'q1', question: 'What?', options: ['A'] }])
    await api.generateQuestions('idea', 'saas', 'm1', 'k1')
    const [, init] = globalThis.fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.idea).toBe('idea')
    expect(body.template).toBe('saas')
    expect(body.model).toBe('m1')
    expect(body.aiKeyId).toBe('k1')
  })
})


describe('getCsrfToken', () => {
  it('returns empty string when no CSRF cookie exists', () => {
    Object.defineProperty(document, 'cookie', { value: '', writable: true })
    expect(getCsrfToken()).toBe('')
  })

  it('extracts CSRF token from cookie', () => {
    Object.defineProperty(document, 'cookie', {
      value: 'other=val; arisehash_csrf=abc123; another=x',
      writable: true
    })
    expect(getCsrfToken()).toBe('abc123')
  })
})

describe('authHeaders', () => {
  it('returns empty headers for GET requests', () => {
    expect(authHeaders('GET')).toEqual({})
    expect(authHeaders('HEAD')).toEqual({})
    expect(authHeaders('OPTIONS')).toEqual({})
  })

  it('returns empty object when no CSRF token available for POST', () => {
    Object.defineProperty(document, 'cookie', { value: '', writable: true })
    expect(authHeaders('POST')).toEqual({})
  })
})
