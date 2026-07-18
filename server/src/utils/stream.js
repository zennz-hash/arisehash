/**
 * Shared SSE (Server-Sent Events) streaming utilities.
 * Centralizes SSE header setup and AI response length limits
 * to avoid duplication across route files.
 */

export const MAX_AI_RESPONSE_LENGTH = 500_000

const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL

/**
 * Sets the standard SSE headers on a response object and calls flushHeaders.
 * @param {import('express').Response} res
 */
export function setSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  try {
    res.write(': connected\n\n')
  } catch {
    // The route-level safe writer handles disconnects after initialization.
  }
}

/**
 * Sends lightweight SSE comments so deployment proxies do not buffer or close
 * long-running AI streams while the upstream model is still thinking.
 * @param {import('express').Response} res
 * @param {() => boolean} isConnected
 * @param {number} intervalMs
 * @returns {() => void}
 */
export function startSSEHeartbeat(res, isConnected = () => true, intervalMs = 15_000) {
  const id = setInterval(() => {
    if (!isConnected() || res.destroyed) return
    try {
      res.write(': keepalive\n\n')
    } catch {
      clearInterval(id)
    }
  }, intervalMs)
  id.unref?.()
  return () => clearInterval(id)
}

/**
 * Converts a raw error into a safe, user-facing message for SSE streams.
 * In production we NEVER forward internal error details (stack traces, upstream
 * hostnames, model identifiers, etc.) to the browser — only generic hints.
 * @param {Error|string} err
 * @returns {string}
 */
export function safeSseError(err) {
  const raw = (err?.message || String(err || '')).toLowerCase()
  if (!IS_PROD) return err?.message || String(err || 'Terjadi kesalahan.')
  // Allow our own friendly messages through (they start with uppercase Indonesian phrases).
  if (/kuota|respons ai melebihi|percakapan|blueprint|proyek|data proyek|tidak ditemukan|wajib/.test(raw)) {
    return err?.message || 'Terjadi kesalahan.'
  }
  // Network / upstream issues
  if (/(fetch failed|econnrefused|enotfound|timeout|network|socket hang up|aborted)/.test(raw)) {
    return 'Layanan AI sedang tidak dapat dijangkau. Mohon coba lagi sebentar.'
  }
  // Auth / rate limit
  if (/(401|403|unauthorized|forbidden|api key|invalid key)/.test(raw)) {
    return 'Konfigurasi layanan AI bermasalah. Hubungi admin.'
  }
  if (/(429|rate limit|quota)/.test(raw)) {
    return 'Layanan AI sedang sibuk. Mohon tunggu sebentar lalu coba lagi.'
  }
  // Default: do NOT leak internals
  return 'Terjadi kesalahan saat memproses permintaan. Mohon coba lagi.'
}
