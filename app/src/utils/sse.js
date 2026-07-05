/**
 * SSE (Server-Sent Events) streaming utility for AI endpoints.
 *
 * Handles byte decoding, line buffering, JSON parsing, and rAF-coalesced
 * token delivery — the core pattern duplicated across Chat.jsx, Store.jsx,
 * and ProductDetail.jsx.
 *
 * @example
 *   try {
 *     const fullText = await readSSEStream(res, {
 *       onChunk: (chunk) => setStreamText(prev => prev + chunk),
 *       signal: controller.signal
 *     })
 *   } catch (err) {
 *     if (err instanceof SSEError) {
 *       addToast(err.message, 'error')
 *     }
 *   }
 */

export class SSEError extends Error {
  /** @param {string} message */
  constructor(message, accumulated) {
    super(message)
    this.name = 'SSEError'
    /** Partial text accumulated before the error occurred. */
    this.accumulated = accumulated || ''
  }
}

/**
 * Efficiently read an SSE stream from a fetch Response.
 *
 * Parses `data: {json}` lines, coalesces `{ token }` delivery via
 * requestAnimationFrame to avoid excessive re-renders, and returns the
 * full accumulated text so callers can use it after the stream ends.
 *
 * @param {Response} response  - Fetch Response with a readable body
 * @param {Object}   [opts]
 * @param {(chunk: string) => void}      [opts.onChunk]  - Called ~60fps with coalesced tokens
 * @param {(parsed: Object, accumulated: string) => (void|Promise<void>)} [opts.onDone]
 *        Called when a `done` event is received (can be async). The stream
 *        pauses until the returned promise resolves, so navigation / setState
 *        inside onDone will be flushed before the caller continues.
 * @param {AbortSignal} [opts.signal]    - AbortSignal to cancel reading mid-stream
 * @returns {Promise<string>} The full accumulated text from all tokens
 * @throws {SSEError}  If the stream sends an `{ error }` event
 */
export async function readSSEStream(response, { onChunk, onDone, signal } = {}) {
  if (!response.body) throw new Error('Respons streaming tidak tersedia')

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let accumulated = ''
  let rafId = 0
  let pending = ''

  /* ---- rAF-coalesced flush ------------------------------------------------- */
  const flush = () => {
    rafId = 0
    if (pending) {
      onChunk?.(pending)
      pending = ''
    }
  }

  const cancelFlush = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  /* ---- Read loop ------------------------------------------------------------ */
  while (true) {
    // Abort check — return partial accumulated text without throwing
    if (signal?.aborted) {
      reader.cancel()
      cancelFlush()
      return accumulated
    }

    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      const clean = line.trim()
      if (!clean.startsWith('data: ')) continue

      // Silently skip malformed JSON lines (non-fatal)
      let parsed
      try {
        parsed = JSON.parse(clean.slice(6))
      } catch {
        continue
      }

      // Error events — throw so the caller can catch & show the message
      if (parsed.error) {
        cancelFlush()
        throw new SSEError(parsed.error, accumulated)
      }

      // Token events — accumulate + schedule a rAF flush
      if (parsed.token) {
        accumulated += parsed.token
        pending += parsed.token
        if (!rafId) rafId = requestAnimationFrame(flush)
      }

      // Done events — flush remaining tokens, call onDone, then return
      if (parsed.done) {
        cancelFlush()
        flush() // deliver any buffered tokens first
        await onDone?.(parsed, accumulated)
        return accumulated
      }
    }
  }

  // Stream ended without a `done` event — flush and return
  cancelFlush()
  return accumulated
}
