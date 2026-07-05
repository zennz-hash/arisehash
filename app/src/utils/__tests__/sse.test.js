import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SSEError, readSSEStream } from '../sse.js'

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Create a mock ReadableStream that yields given UTF-8 chunks.
 * Each chunk is a Uint8Array encoded from the string.
 */
function createStream(chunks) {
  const encoder = new TextEncoder()
  let i = 0
  return {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) return { done: true, value: undefined }
          return { done: false, value: encoder.encode(chunks[i++]) }
        },
        cancel() { /* noop */ },
      }
    },
  }
}

/**
 * Build a Response-like object from a mock ReadableStream.
 */
function mockResponse(chunks) {
  return { body: createStream(chunks), ok: true }
}

/* ── SSEError ───────────────────────────────────────────────────────────── */

describe('SSEError', () => {
  it('extends Error with name SSEError', () => {
    const err = new SSEError('test error')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('SSEError')
    expect(err.message).toBe('test error')
  })

  it('carries accumulated text', () => {
    const err = new SSEError('boom', 'partial text')
    expect(err.accumulated).toBe('partial text')
  })

  it('defaults accumulated to empty string', () => {
    const err = new SSEError('boom')
    expect(err.accumulated).toBe('')
  })
})

/* ── readSSEStream ──────────────────────────────────────────────────────── */

describe('readSSEStream', () => {
  beforeEach(() => {
    // Make requestAnimationFrame fire synchronously on next microtask
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(performance.now()), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('throws if response has no body', async () => {
    await expect(readSSEStream({})).rejects.toThrow('Respons streaming tidak tersedia')
  })

  it('accumulates tokens and returns full text', async () => {
    const res = mockResponse([
      'data: {"token":"Hello"}\n',
      'data: {"token":" World"}\n',
      'data: {"done":true}\n',
    ])
    const onChunk = vi.fn()
    const onDone = vi.fn()

    const promise = readSSEStream(res, { onChunk, onDone })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('Hello World')
  })

  it('calls onChunk with coalesced tokens', async () => {
    const res = mockResponse([
      'data: {"token":"abc"}\n',
      'data: {"token":"def"}\n',
      'data: {"done":true}\n',
    ])
    const onChunk = vi.fn()

    const promise = readSSEStream(res, { onChunk })
    await vi.runAllTimersAsync()
    await promise

    // onChunk should have been called with coalesced tokens
    expect(onChunk).toHaveBeenCalled()
    // The total of all calls should equal 'abcdef'
    const total = onChunk.mock.calls.reduce((acc, [c]) => acc + c, '')
    expect(total).toBe('abcdef')
  })

  it('calls onDone with parsed data and accumulated text', async () => {
    const res = mockResponse([
      'data: {"token":"Hi"}\n',
      'data: {"done":true, "id":"123"}\n',
    ])
    const onDone = vi.fn()

    const promise = readSSEStream(res, { onDone })
    await vi.runAllTimersAsync()
    await promise

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone.mock.calls[0][0]).toMatchObject({ done: true, id: '123' })
    expect(onDone.mock.calls[0][1]).toBe('Hi')
  })

  it('throws SSEError on error event and carries accumulated text', async () => {
    const res = mockResponse([
      'data: {"token":"Before crash"}\n',
      'data: {"error":"API failure"}\n',
    ])
    const onError = vi.fn()

    try {
      await readSSEStream(res)
    } catch (err) {
      expect(err).toBeInstanceOf(SSEError)
      expect(err.message).toBe('API failure')
      expect(err.accumulated).toBe('Before crash')
    }
  })

  it('silently skips non-data lines', async () => {
    const res = mockResponse([
      ':keepalive\n',
      'data: {"token":"OK"}\n',
      'event: custom\n',
      'data: {"done":true}\n',
    ])
    const fn = vi.fn()

    const promise = readSSEStream(res, { onChunk: fn })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('OK')
  })

  it('silently skips malformed JSON lines', async () => {
    const res = mockResponse([
      'data: {broken json}\n',
      'data: {"token":"works"}\n',
      'data: {"done":true}\n',
    ])

    const promise = readSSEStream(res)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('works')
  })

  it('handles partial lines across chunks', async () => {
    const res = mockResponse([
      'data: {"token":"Hel',
      'lo"}\ndata: {"token":" World"}\n',
      'data: {"done":true}\n',
    ])

    const promise = readSSEStream(res)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('Hello World')
  })

  it('returns early on abort signal with partial text', async () => {
    const controller = new AbortController()
    const res = mockResponse([
      'data: {"token":"Partial"}\n',
      // Abort before done — stream cut short
    ])
    const onChunk = vi.fn()

    const promise = readSSEStream(res, { signal: controller.signal, onChunk })

    // Let a few tokens flow, then abort
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    // After some tokens, abort
    controller.abort()

    const result = await promise
    expect(result).toBe('Partial')
  })

  it('handles async onDone callback', async () => {
    const res = mockResponse([
      'data: {"token":"Done"}\n',
      'data: {"done":true}\n',
    ])
    const marker = vi.fn()

    const promise = readSSEStream(res, {
      onDone: async () => {
        marker('called')
      },
    })
    await vi.runAllTimersAsync()
    await promise

    expect(marker).toHaveBeenCalledWith('called')
  })

  it('does not crash on empty response body (no data events)', async () => {
    const res = mockResponse(['\n', '\n'])

    const promise = readSSEStream(res)
    const result = await promise

    expect(result).toBe('')
  })
})
