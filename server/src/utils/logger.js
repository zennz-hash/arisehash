/**
 * Shared server-side logging helpers.
 * Centralizes console.error/warn patterns to enable consistent formatting
 * and potential future integration with Sentry or other monitoring.
 *
 * Usage:
 *   import { logError, logWarn } from './logger.js'
 *   logError('AI Log', 'Failed to save log', err)
 *   logWarn('AI', 'admin model failed', err)
 */

/** Log an error with a structured prefix. */
export function logError(context, message, err) {
  const detail = extractDetail(err)
  console.error(`[${context}] ${message}:`, detail)
}

/** Log a warning with a structured prefix. */
export function logWarn(context, message, err) {
  const detail = extractDetail(err)
  console.warn(`[${context}] ${message}:`, detail)
}

/** Log a general info message with a structured prefix. */
export function logInfo(context, message, ...args) {
  console.log(`[${context}] ${message}`, ...args)
}

function extractDetail(err) {
  if (!err) return ''
  if (err instanceof Error) return err.message
  return String(err)
}
