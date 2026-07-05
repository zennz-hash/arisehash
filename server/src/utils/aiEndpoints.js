// Builder URL endpoint AI yang toleran terhadap cara user menulis Base URL.
// Banyak gateway (OpenRouter, Groq, Aerolink, FreeModel, Kimchi.dev, dll) berbeda
// soal apakah Base URL sudah memuat segmen versi (/v1) atau endpoint penuh.

function trimTrailingSlash(u) {
  return String(u || '').trim().replace(/\/+$/, '')
}

// Endpoint chat-completions (OpenAI-compatible).
//  - sudah berisi /chat/completions (atau /completions, /responses) → pakai apa adanya
//  - berakhir pada segmen versi (/v1, /openai/v1, /api/v1)            → +/chat/completions
//  - host polos                                                       → asumsikan +/v1/chat/completions
export function openaiChatUrl(baseUrl) {
  const b = trimTrailingSlash(baseUrl)
  if (/\/(chat\/completions|completions|responses)$/i.test(b)) return b
  if (/\/v\d+$/i.test(b)) return `${b}/chat/completions`
  return `${b}/v1/chat/completions`
}

// Endpoint messages (Anthropic). Menghindari dobel /v1.
//  - sudah berisi /messages          → pakai apa adanya
//  - berakhir pada segmen versi /v1  → +/messages
//  - host polos                      → +/v1/messages
export function anthropicMessagesUrl(baseUrl) {
  const b = trimTrailingSlash(baseUrl)
  if (/\/messages$/i.test(b)) return b
  if (/\/v\d+$/i.test(b)) return `${b}/messages`
  return `${b}/v1/messages`
}

/**
 * Detects whether a provider is Anthropic/Claude.
 * Used in ai.js and aiTest.js for routing to the correct API format.
 * @param {string} provider
 * @returns {boolean}
 */
export function isAnthropic(provider) {
  const p = String(provider || '').toLowerCase()
  return p === 'anthropic' || p === 'claude'
}
