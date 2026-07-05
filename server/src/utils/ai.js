import { prisma } from '../db.js'
import { decryptSecret } from './crypto.js'
import { openaiChatUrl, anthropicMessagesUrl, isAnthropic } from './aiEndpoints.js'
import { fetchWithTimeout } from './fetch.js'
import { getActiveSubscription } from './quota.js'
import { logError, logWarn, logInfo } from './logger.js'

function logRequest(data) {
  if (!data.userId) return
  prisma.aiRequestLog
    .create({ data })
    .catch((err) => logError('AI Log', 'Failed to save log', err))
}

function markAiKeyUsed(custom) {
  if (!custom?.id) return
  prisma.userAiKey.update({
    where: { id: custom.id },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() }
  }).catch((err) => logError('AI Key', 'Failed to mark usage', err))
}

function markAdminAiKeyUsed(adminKeyId, tokens = 0) {
  if (!adminKeyId) return
  prisma.adminAiKey.update({
    where: { id: adminKeyId },
    data: {
      totalRequests: { increment: 1 },
      totalTokens: { increment: tokens },
      lastUsedAt: new Date()
    }
  }).catch((err) => logError('Admin AI Key', 'Failed to track usage', err))
}

/**
 * Resolve all active admin-managed AI models.
 * Returns array of { id, label, baseUrl, apiKey, model } from active AdminAiKey records.
 */
export async function resolveModels() {
  try {
    const keys = await prisma.adminAiKey.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    })
    return keys.map((k) => ({
      id: k.id,
      label: k.label,
      provider: k.provider,
      model: k.model,
      baseUrl: k.baseUrl,
      apiKey: decryptSecret(k.apiKey),
    }))
  } catch (err) {
        logError('Admin AI Key', 'Failed to resolve', err)
    return []
  }
}

/**
 * Resolve a single admin model by its id.
 */
async function resolveAdminModel(modelId) {
  if (!modelId) return null
  try {
    const k = await prisma.adminAiKey.findFirst({
      where: { id: modelId, isActive: true }
    })
    if (!k) return null
    return {
      id: k.id,
      label: k.label,
      provider: k.provider,
      model: k.model,
      baseUrl: k.baseUrl,
      apiKey: decryptSecret(k.apiKey),
    }
  } catch (err) {
        logError('Admin AI Key', 'Failed to resolve model', err)
    return null
  }
}

/**
 * Resolve the selected admin model, followed by any active siblings (same model ID/name) for automatic failover.
 * If no modelId is specified, returns all active models.
 */
export async function resolveModelsForRequest(modelId) {
  if (!modelId) {
    return resolveModels()
  }
  try {
    const target = await prisma.adminAiKey.findFirst({
      where: { id: modelId, isActive: true }
    })
    if (!target) {
      // Model ID tidak ditemukan — fallback ke semua model aktif
      return resolveModels()
    }

    const siblings = await prisma.adminAiKey.findMany({
      where: { model: target.model, isActive: true, id: { not: target.id } },
      orderBy: { createdAt: 'desc' }
    })

    // Global failover: append all other active models that are NOT the target or its siblings
    const others = await prisma.adminAiKey.findMany({
      where: {
        isActive: true,
        id: { notIn: [target.id, ...siblings.map(s => s.id)] }
      },
      orderBy: { createdAt: 'desc' }
    })

    return [target, ...siblings, ...others].map((k) => ({
      id: k.id,
      label: k.label,
      provider: k.provider,
      model: k.model,
      baseUrl: k.baseUrl,
      apiKey: decryptSecret(k.apiKey),
    }))
  } catch (err) {
        logError('Admin AI Key', 'Failed to resolve models for request', err)
    return []
  }
}

function preprocessMessagesForVision(messages) {
  if (!Array.isArray(messages)) return messages
  return messages.map((m) => {
    if (m.role !== 'user' || typeof m.content !== 'string') {
      return m
    }

    const imgRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g
    const images = []
    let match
    while ((match = imgRegex.exec(m.content)) !== null) {
      images.push(match[2])
    }

    if (images.length === 0) {
      return m
    }

    // Clean text by removing images and file tags
    let text = m.content
      .replace(/!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g, '')
      .replace(/\[Lampiran: ([^\]]+) \(([^)]+)\)\]/g, '')
      .trim()

    const contentArray = []
    if (text) {
      contentArray.push({ type: 'text', text })
    }
    for (const url of images) {
      contentArray.push({
        type: 'image_url',
        image_url: { url }
      })
    }

    return {
      ...m,
      content: contentArray
    }
  })
}

function toAnthropicMessages(messages) {
  let system = null
  const msgs = []
  for (const m of messages) {
    if (m.role === 'system') {
      system = (system ? system + '\n\n' : '') + (Array.isArray(m.content) ? m.content.map(c => c.text || '').join('\n') : m.content)
      continue
    }
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    let content = m.content
    if (Array.isArray(content)) {
      content = content.map(c => c.text || '').join('\n')
    }
    msgs.push({ role, content })
  }
  return { system, messages: msgs }
}

function toAnthropicParams({ model, messages, stream, options }) {
  const { system, messages: anthropicMessages } = toAnthropicMessages(messages)
  const body = { model, max_tokens: 16384, messages: anthropicMessages }
  if (system) body.system = system
  if (stream) body.stream = true
  // Anthropic ignores response_format, so don't forward it.
  if (options?.temperature !== undefined) body.temperature = options.temperature
  if (options?.max_tokens !== undefined) body.max_tokens = options.max_tokens
  return body
}

async function fetchAnthropicCompletion({ baseUrl, apiKey, model, messages, options }) {
  const body = toAnthropicParams({ model, messages, options })
  const response = await fetchWithTimeout(anthropicMessagesUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  }, { timeoutMs: 290_000, validateIp: true })
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    throw new Error(errBody.error?.message || `HTTP ${response.status}`)
  }
  const data = await response.json()
  const content = data.content?.[0]?.text ?? ''
  const usage = data.usage
    ? (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
    : 0
  return { content, tokens: usage }
}

async function streamAnthropicCompletion({ baseUrl, apiKey, model, messages }, onToken) {
  const body = toAnthropicParams({ model, messages, stream: true })
  const response = await fetchWithTimeout(anthropicMessagesUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  }, { timeoutMs: 290_000, validateIp: true })
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}))
    throw new Error(errBody.error?.message || `HTTP ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let inputTokens = 0
  let outputTokens = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    let eventType = null
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) { eventType = null; continue }
      if (trimmed.startsWith('event:')) {
        eventType = trimmed.slice(6).trim()
        continue
      }
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload)
        if (eventType === 'content_block_delta' && parsed.delta?.text) {
          onToken(parsed.delta.text)
        }
        // Track token usage from Anthropic streaming events
        if (eventType === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens || 0
        }
        if (eventType === 'message_delta' && parsed.usage) {
          outputTokens = parsed.usage.output_tokens || 0
        }
      } catch { /* ignore malformed */ }
    }
  }
  return { tokens: inputTokens + outputTokens }
}

// Turn low-level failures into a friendly, user-facing message.
function friendlyAiError(modelLabel, lastError) {
  const raw = (lastError?.message || '').toLowerCase()
  const label = modelLabel || 'AI'
  if (raw.includes('fetch failed') || raw.includes('econnrefused') || raw.includes('enotfound') || raw.includes('network') || raw.includes('timeout')) {
    return `Layanan ${label} sedang tidak dapat dijangkau. Coba lagi sebentar atau gunakan model lain.`
  }
  if (raw.includes('401') || raw.includes('403') || raw.includes('unauthorized') || raw.includes('api key') || raw.includes('invalid key')) {
    return `Layanan ${label} belum dikonfigurasi dengan benar (API key). Hubungi admin.`
  }
  if (raw.includes('429') || raw.includes('rate') || raw.includes('quota')) {
    return `Layanan ${label} sedang sibuk (batas pemakaian). Mohon tunggu sebentar lalu coba lagi.`
  }
  return `Layanan ${label} sedang bermasalah. Mohon coba lagi nanti.`
}

function stripThinkTags(text) {
  return text.replace(/\<think\>[\s\S]*?<\/think>/g, '').trim()
}

// Some proxies (e.g. 9Router) always return SSE text/event-stream even for
// non-streaming requests. Read the body as text first so we can try JSON.parse
// and fall back to accumulating all data: JSON objects from SSE text.
async function parseJsonResponse(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch (err) {
    const lines = text.split('\n')
    let fullContent = ''
    let lastParsed = null
    let hasSse = false

    for (const line of lines) {
      const clean = line.trim()
      if (!clean || !clean.startsWith('data:')) continue
      hasSse = true
      const payload = clean.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload)
        lastParsed = parsed
        const token = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || ''
        fullContent += token
      } catch {
        // ignore malformed JSON or keep-alive lines
      }
    }

    if (hasSse && lastParsed) {
      return {
        ...lastParsed,
        choices: [
          {
            ...lastParsed.choices?.[0],
            message: {
              role: 'assistant',
              content: fullContent
            }
          }
        ]
      }
    }
    throw new Error('Unexpected response format: ' + err.message)
  }
}

export function createThinkFilter(onToken) {
  let all = ''
  let visibleEnd = 0
  let inThink = false
  const RE_OPEN = /<think>/g
  const RE_CLOSE = /<\/think>/g
  return (token) => {
    all += token
    let changed = true
    let safety = 0
    while (changed && safety++ < 20) {
      changed = false
      if (!inThink) {
        RE_OPEN.lastIndex = visibleEnd
        const m = RE_OPEN.exec(all)
        if (m) {
          if (m.index > visibleEnd) onToken(all.slice(visibleEnd, m.index))
          inThink = true
          visibleEnd = m.index + m[0].length
          changed = true
        }
      }
      if (inThink) {
        RE_CLOSE.lastIndex = visibleEnd
        const m = RE_CLOSE.exec(all)
        if (m) {
          inThink = false
          visibleEnd = m.index + m[0].length
          changed = true
        }
      }
    }
    if (!inThink && all.length > visibleEnd) {
      // Guard: pause if pending text starts with characters matching the start of <think> or </think>
      const pending = all.slice(visibleEnd)
      // Only suppress if the pending text is a strict prefix of an opening/closing think tag
      const isThinkPrefix = pending.length < 7 && '<think>'.startsWith(pending) && pending === pending.toLowerCase()
      const isClosePrefix = pending.length < 8 && '<\/think>'.startsWith(pending) && pending === pending.toLowerCase()
      // Also suppress single '<' at end which might be start of any tag
      const isLoneBracket = pending === '<'
      if (isThinkPrefix || isClosePrefix || isLoneBracket) {
        return
      }
      onToken(pending)
      visibleEnd = all.length
    }
  }
}

/**
 * Resolve the effective admin model id for a user, enforcing free-tier restrictions.
 * Free tier users are forced to a mimo-v2.5 model and cannot use BYOK keys.
 */
async function resolveModelIdForUser(userId, modelId, custom) {
  if (!userId) return modelId
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.role === 'ADMIN') return modelId
  const sub = await getActiveSubscription(userId)
  if (sub?.planType !== 'FREE') return modelId
  if (custom) {
    throw new Error('Akun Free Tier tidak dapat menggunakan API Key sendiri. Silakan upgrade ke plan Pro atau Pro Max.')
  }
  const freeModel = await prisma.adminAiKey.findFirst({
    where: { model: { startsWith: 'mimo-v2.5' }, isActive: true }
  })
  if (!freeModel) {
    throw new Error('Model MiMo 2.5 tidak aktif atau tidak ditemukan. Hubungi admin.')
  }
  return freeModel.id
}

/**
 * Non-streaming chat completion with automatic model failover across active admin models.
 * @param {Array}  messages OpenAI-style message list
 * @param {Object} options  extra request body params (e.g. response_format)
 * @param {string} userId   initiating user (for logging)
 * @param {string} modelId  admin model id
 * @param {Object} custom   BYOK config { baseUrl, apiKey, model }
 * @returns {Promise<string>} assistant message content
 */
export async function generateCompletion(messages, options = {}, userId = null, modelId = null, custom = null) {
  const startedAt = Date.now()
  const processedMessages = preprocessMessagesForVision(messages)
  const activeModelId = await resolveModelIdForUser(userId, modelId, custom)

  // Custom (BYOK) path: single attempt with the user's own endpoint/key/model.
  if (custom && custom.apiKey && custom.baseUrl && custom.model) {
    try {
      let content = ''
      if (isAnthropic(custom.provider)) {
        const result = await fetchAnthropicCompletion({ baseUrl: custom.baseUrl, apiKey: custom.apiKey, model: custom.model, messages: processedMessages, options })
        content = result.content
      } else {
        const response = await fetchWithTimeout(openaiChatUrl(custom.baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custom.apiKey}` },
          body: JSON.stringify({ model: custom.model, messages: processedMessages, ...options })
        }, { timeoutMs: 290_000, validateIp: true })
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error?.message || `HTTP ${response.status}`)
        }
        const data = await parseJsonResponse(response)
        content = stripThinkTags(data.choices?.[0]?.message?.content ?? '')
      }
      markAiKeyUsed(custom)
      logRequest({ userId, modelUsed: `custom:${custom.model}`, durationMs: Date.now() - startedAt, success: true })
      return content
    } catch (err) {
      logRequest({ userId, modelUsed: `custom:${custom.model}`, durationMs: Date.now() - startedAt, success: false, errorMessage: err.message })
      throw new Error(`Model kustom gagal: ${err.message}`)
    }
  }

  // Resolve target admin models (with failover options for siblings).
  const allModels = await resolveModelsForRequest(activeModelId)

  if (allModels.length === 0) {
    throw new Error('Tidak ada model AI yang aktif. Hubungi admin untuk menambahkan model.')
  }

  let lastError = null
  for (const m of allModels) {
    if (!m.apiKey) continue
    try {
      logInfo('AI', `completion via ${m.model} (${m.id})`)
      let content = ''
      if (isAnthropic(m.provider)) {
        const result = await fetchAnthropicCompletion({ baseUrl: m.baseUrl, apiKey: m.apiKey, model: m.model, messages: processedMessages, options })
        content = result.content
        markAdminAiKeyUsed(m.id, result.tokens)
      } else {
        const response = await fetchWithTimeout(openaiChatUrl(m.baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${m.apiKey}` },
          body: JSON.stringify({ model: m.model, messages: processedMessages, ...options })
        }, { timeoutMs: 290_000, validateIp: true })
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error?.message || `HTTP ${response.status}`)
        }
        const data = await parseJsonResponse(response)
        const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
        markAdminAiKeyUsed(m.id, tokens)
        content = stripThinkTags(data.choices?.[0]?.message?.content ?? '')
      }
      logRequest({ userId, modelUsed: `admin:${m.model}`, durationMs: Date.now() - startedAt, success: true })
      return content
    } catch (err) {
      logWarn('AI', `admin model ${m.id} failed`, err)
      lastError = err
      logRequest({ userId, modelUsed: `admin:${m.model}`, durationMs: Date.now() - startedAt, success: false, errorMessage: err.message })
    }
  }

  const label = allModels[0]?.label || 'AI'
  throw new Error(friendlyAiError(label, lastError))
}

/**
 * Streams a chat completion. Tokens are forwarded to `onToken(text)` as they
 * arrive. The function resolves when the upstream stream ends. Failover across
 * active admin models is only attempted before the first token is emitted.
 *
 * @param {Array}    messages OpenAI-style message list
 * @param {Function} onToken  callback invoked with each text delta
 * @param {string}   userId   initiating user (for logging)
 * @param {string}   modelId  admin model id
 * @param {Object}   custom   BYOK config { baseUrl, apiKey, model }
 */
export async function streamCompletion(messages, onTokenRaw, userId = null, modelId = null, custom = null) {
  const startedAt = Date.now()
  const onToken = createThinkFilter(onTokenRaw)
  const processedMessages = preprocessMessagesForVision(messages)
  const activeModelId = await resolveModelIdForUser(userId, modelId, custom)

  // Custom (BYOK) path: stream from the user's own endpoint/key/model.
  if (custom && custom.apiKey && custom.baseUrl && custom.model) {
    try {
      if (isAnthropic(custom.provider)) {
        await streamAnthropicCompletion({ baseUrl: custom.baseUrl, apiKey: custom.apiKey, model: custom.model, messages: processedMessages }, onToken)
      } else {
        const response = await fetchWithTimeout(openaiChatUrl(custom.baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custom.apiKey}` },
          body: JSON.stringify({ model: custom.model, messages: processedMessages, stream: true, max_tokens: 16384 })
        }, { timeoutMs: 290_000, validateIp: true })
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error?.message || `HTTP ${response.status}`)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            const clean = line.trim()
            if (!clean || !clean.startsWith('data: ')) continue
            const payload = clean.slice(6)
            if (payload === '[DONE]') continue
            try {
              const parsed = JSON.parse(payload)
              const token = parsed.choices?.[0]?.delta?.content || ''
              if (token) onToken(token)
            } catch { /* ignore keep-alive */ }
          }
        }
      }
      markAiKeyUsed(custom)
      logRequest({ userId, modelUsed: `custom:${custom.model}`, durationMs: Date.now() - startedAt, success: true })
      return
    } catch (err) {
      logRequest({ userId, modelUsed: `custom:${custom.model}`, durationMs: Date.now() - startedAt, success: false, errorMessage: err.message })
      throw new Error(`Model kustom gagal: ${err.message}`)
    }
  }

  // Resolve target admin models (with failover options for siblings).
  const allModels = await resolveModelsForRequest(activeModelId)

  if (allModels.length === 0) {
    throw new Error('Tidak ada model AI yang aktif. Hubungi admin untuk menambahkan model.')
  }

  let lastError = null

  for (const m of allModels) {
    if (!m.apiKey) continue
    let emitted = false
    try {
      logInfo('AI', `streaming via ${m.model} (${m.id})`)
      if (isAnthropic(m.provider)) {
        const { tokens } = await streamAnthropicCompletion({ baseUrl: m.baseUrl, apiKey: m.apiKey, model: m.model, messages: processedMessages }, (token) => {
          emitted = true
          onToken(token)
        })
        markAdminAiKeyUsed(m.id, tokens)
      } else {
        const response = await fetchWithTimeout(openaiChatUrl(m.baseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${m.apiKey}` },
          body: JSON.stringify({ model: m.model, messages: processedMessages, stream: true, max_tokens: 16384 })
        }, { timeoutMs: 290_000, validateIp: true })
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error?.message || `HTTP ${response.status}`)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        let totalTokens = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            const clean = line.trim()
            if (!clean || !clean.startsWith('data: ')) continue
            const payload = clean.slice(6)
            if (payload === '[DONE]') continue
            try {
              const parsed = JSON.parse(payload)
              const token = parsed.choices?.[0]?.delta?.content || ''
              if (token) {
                emitted = true
                onToken(token)
              }
              if (parsed.usage) totalTokens = (parsed.usage.prompt_tokens || 0) + (parsed.usage.completion_tokens || 0)
            } catch { /* ignore keep-alive */ }
          }
        }
        markAdminAiKeyUsed(m.id, totalTokens)
      }
      logRequest({ userId, modelUsed: `admin:${m.model}`, durationMs: Date.now() - startedAt, success: true })
      return
    } catch (err) {
      logWarn('AI', `admin model ${m.id} stream failed`, err)
      lastError = err
      logRequest({ userId, modelUsed: `admin:${m.model}`, durationMs: Date.now() - startedAt, success: false, errorMessage: err.message })
      if (emitted) {
        const label = allModels[0]?.label || 'AI'
        throw new Error(friendlyAiError(label, err))
      }
    }
  }

  const label = allModels[0]?.label || 'AI'
  throw new Error(friendlyAiError(label, lastError))
}
