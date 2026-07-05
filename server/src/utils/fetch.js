import { validateResolvedIp } from './urlSafety.js'

/**
 * Fetch with configurable timeout and optional DNS rebinding protection.
 *
 * @param {string|URL} url       - Target URL
 * @param {object}     options   - Standard fetch options (merged with AbortSignal)
 * @param {object}     opts
 * @param {number}     opts.timeoutMs  - Timeout in milliseconds (default 30_000)
 * @param {boolean}    opts.validateIp - Whether to run DNS rebinding check (default false)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, { timeoutMs = 30_000, validateIp = false } = {}) {
  if (validateIp) {
    const parsed = typeof url === 'string' ? new URL(url) : url
    await validateResolvedIp(parsed.hostname)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
