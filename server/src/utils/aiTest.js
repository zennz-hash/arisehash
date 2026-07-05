// Pengujian koneksi API key (BYOK & admin) yang tangguh terhadap variasi gateway.
import { openaiChatUrl, anthropicMessagesUrl } from './aiEndpoints.js'
import { validateResolvedIp } from './urlSafety.js'
import { fetchWithTimeout } from './fetch.js'

export { isAnthropic } from './aiEndpoints.js'

// Ambil pesan error yang bisa dibaca dari berbagai bentuk respons (JSON beragam, teks, atau HTML).
function extractError(text, status) {
  if (text) {
    try {
      const j = JSON.parse(text)
      const msg = j?.error?.message
        || (typeof j?.error === 'string' ? j.error : null)
        || j?.message || j?.detail || j?.error?.code
      if (msg) return typeof msg === 'string' ? msg : JSON.stringify(msg)
    } catch { /* bukan JSON */ }
    const snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
    if (snippet) return `HTTP ${status} — ${snippet}`
  }
  return `HTTP ${status}`
}

// Ambil teks balasan dari body JSON biasa ATAU body SSE (data: ...) — beberapa gateway selalu balas SSE.
function extractContent(text) {
  if (!text) return ''
  try {
    const j = JSON.parse(text)
    return j.choices?.[0]?.message?.content
      || j.choices?.[0]?.text
      || j.content?.[0]?.text
      || ''
  } catch { /* mungkin SSE */ }
  let out = ''
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const payload = t.slice(5).trim()
    if (payload === '[DONE]') continue
    try {
      const p = JSON.parse(payload)
      out += p.choices?.[0]?.delta?.content || p.choices?.[0]?.message?.content || p.delta?.text || ''
    } catch { /* abaikan keep-alive / malformed */ }
  }
  return out
}

export async function testOpenAI({ baseUrl, apiKey, model }) {
  const url = new URL(openaiChatUrl(baseUrl))
  await validateResolvedIp(url.hostname)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${String(apiKey).trim()}` }
  const base = { model: String(model).trim(), messages: [{ role: 'user', content: 'ping' }] }

  let r = await fetchWithTimeout(url.toString(), { method: 'POST', headers, body: JSON.stringify({ ...base, max_tokens: 16 }) })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    // Model reasoning (o1/o3/gpt-5 dsb.) menolak `max_tokens` → coba ulang dengan `max_completion_tokens`.
    if (r.status === 400 && /max_tokens|max_completion_tokens|unsupported parameter/i.test(text)) {
      r = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify({ ...base, max_completion_tokens: 16 }) })
      if (!r.ok) throw new Error(extractError(await r.text().catch(() => ''), r.status))
    } else {
      throw new Error(extractError(text, r.status))
    }
  }
  return extractContent(await r.text().catch(() => ''))
}

export async function testAnthropic({ baseUrl, apiKey, model }) {
  const url = new URL(anthropicMessagesUrl(baseUrl))
  await validateResolvedIp(url.hostname)
  const r = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': String(apiKey).trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: String(model).trim(), max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] }),
  })
  if (!r.ok) throw new Error(extractError(await r.text().catch(() => ''), r.status))
  return extractContent(await r.text().catch(() => ''))
}
