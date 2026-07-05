import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { encryptSecret, decryptSecret, maskSecret } from '../utils/crypto.js'
import { normalizeAiBaseUrl } from '../utils/urlSafety.js'
import { validate } from '../middleware/validate.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { createAiKeySchema, updateAiKeySchema } from '../schemas/aiKey.schema.js'
import { isAnthropic, testOpenAI, testAnthropic } from '../utils/aiTest.js'

const router = Router()
const userTestLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 5 })

// Shape returned to the client (never includes the raw key).
function publicShape(k) {
  return {
    id: k.id,
    label: k.label,
    provider: k.provider,
    baseUrl: k.baseUrl,
    model: k.model,
    keyMasked: maskSecret(decryptSecret(k.apiKey)),
    usageCount: k.usageCount || 0,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }
}

/**
 * Resolve a user's custom AI config for use by AI routes.
 * Returns { provider, baseUrl, apiKey, model } or null if not found/owned.
 */
export async function resolveUserAiKey(userId, aiKeyId) {
  if (!aiKeyId) return null
  const k = await prisma.userAiKey.findFirst({ where: { id: aiKeyId, userId } })
  if (!k) return null
  const apiKey = decryptSecret(k.apiKey)
  if (!apiKey) return null
  return { id: k.id, provider: k.provider, baseUrl: normalizeAiBaseUrl(k.baseUrl), apiKey, model: k.model }
}

// POST /api/ai-keys/test-connection - test AI connection without saving
router.post('/test-connection', requireAuth, userTestLimiter, async (req, res, next) => {
  try {
    const { baseUrl, apiKey, model, provider } = req.body || {}
    if (!baseUrl || !apiKey || !model) {
      return res.status(400).json({ ok: false, error: 'Base URL, API key, dan model wajib diisi.' })
    }
    const safeBaseUrl = normalizeAiBaseUrl(baseUrl)
    const prov = (provider || 'openai').trim().toLowerCase()
    const reply = isAnthropic(prov)
      ? await testAnthropic({ baseUrl: safeBaseUrl, apiKey, model })
      : await testOpenAI({ baseUrl: safeBaseUrl, apiKey, model })
    res.json({ ok: true, message: 'Koneksi berhasil. Model siap dipakai.', reply: reply.slice(0, 100) })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// GET /api/ai-keys - list user's saved models (no secrets)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const keys = await prisma.userAiKey.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } })
    res.json(keys.map(publicShape))
  } catch (err) {
    next(err)
  }
})

// POST /api/ai-keys - add a model
router.post('/', requireAuth, validate(createAiKeySchema), async (req, res, next) => {
  try {
    const { label, provider, baseUrl, apiKey, model } = req.body
    const safeBaseUrl = normalizeAiBaseUrl(baseUrl)
    const created = await prisma.userAiKey.create({
      data: {
        userId: req.user.id,
        label: (label || '').trim() || 'Model Saya',
        provider: (provider || 'custom').trim(),
        baseUrl: safeBaseUrl,
        apiKey: encryptSecret(apiKey.trim()),
        model: model.trim(),
      }
    })
    res.json(publicShape(created))
  } catch (err) {
    next(err)
  }
})

// PUT /api/ai-keys/:id - update (apiKey optional: only re-encrypt if provided)
router.put('/:id', requireAuth, validate(updateAiKeySchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await prisma.userAiKey.findFirst({ where: { id, userId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Model tidak ditemukan' })
    const { label, provider, baseUrl, apiKey, model } = req.body || {}
    const data = {}
    if (label !== undefined) data.label = (label || '').trim() || 'Model Saya'
    if (provider !== undefined) data.provider = (provider || 'custom').trim()
    if (baseUrl !== undefined) data.baseUrl = normalizeAiBaseUrl(baseUrl)
    if (model !== undefined) data.model = model.trim()
    if (apiKey) data.apiKey = encryptSecret(apiKey.trim())
    const updated = await prisma.userAiKey.update({ where: { id }, data })
    res.json(publicShape(updated))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/ai-keys/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await prisma.userAiKey.findFirst({ where: { id, userId: req.user.id } })
    if (!existing) return res.status(404).json({ error: 'Model tidak ditemukan' })
    await prisma.userAiKey.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/ai-keys/:id/test - verify the saved model responds
router.post('/:id/test', requireAuth, userTestLimiter, async (req, res, next) => {
  try {
    const cfg = await resolveUserAiKey(req.user.id, req.params.id)
    if (!cfg) return res.status(404).json({ error: 'Model tidak ditemukan' })
    const reply = isAnthropic(cfg.provider)
      ? await testAnthropic(cfg)
      : await testOpenAI(cfg)
    res.json({ ok: true, message: 'Koneksi berhasil. Model siap dipakai.', reply: reply.slice(0, 100) })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

export default router
