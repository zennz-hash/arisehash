/**
 * Shared server configuration constants.
 * Centralizes environment checks and defaults used across modules.
 */

export const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
