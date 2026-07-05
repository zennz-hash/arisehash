import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { validate, validateParams } from '../middleware/validate.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { updateSubscriptionSchema } from '../schemas/admin.schema.js'
import { adminAiKeySchema, updateAdminAiKeySchema } from '../schemas/adminAiKey.schema.js'
import { encryptSecret, decryptSecret, maskSecret } from '../utils/crypto.js'
import { normalizeAiBaseUrl } from '../utils/urlSafety.js'
import { isAnthropic, testOpenAI, testAnthropic } from '../utils/aiTest.js'

function csv(rows) {
  return rows.map((row) => row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
}

const router = Router()
const adminTestLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 10 })

router.use(requireAuth, requireAdmin)

// GET /api/admin/stats - Retrieve overall admin metrics
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalBlueprints,
      totalProjects,
      totalAiLogs,
      successAiLogs,
      failAiLogs,
      planCounts,
      recentLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.blueprint.count(),
      prisma.codeProject.count(),
      prisma.aiRequestLog.count(),
      prisma.aiRequestLog.count({ where: { success: true } }),
      prisma.aiRequestLog.count({ where: { success: false } }),
      prisma.planSubscription.groupBy({
        by: ['planType'],
        _count: true
      }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } }
      })
    ])

    const planStats = Object.fromEntries(planCounts.map(p => [p.planType, p._count]))

    res.json({
      totalUsers,
      totalBlueprints,
      totalProjects,
      aiRequestStats: {
        total: totalAiLogs,
        success: successAiLogs,
        fail: failAiLogs
      },
      planStats,
      recentLogs
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/observability - operational health snapshot
router.get('/observability', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [aiTotal, aiFail, avgDuration, recentErrors, activeSessions, publicCodeShares] = await Promise.all([
      prisma.aiRequestLog.count({ where: { createdAt: { gte: since } } }),
      prisma.aiRequestLog.count({ where: { createdAt: { gte: since }, success: false } }),
      prisma.aiRequestLog.aggregate({ where: { createdAt: { gte: since }, durationMs: { not: null } }, _avg: { durationMs: true } }),
      prisma.aiRequestLog.findMany({
        where: { success: false },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { email: true } } }
      }),
      prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.codeProject.count({ where: { isPublic: true } })
    ])
    res.json({
      ai24h: { total: aiTotal, failed: aiFail, successRate: aiTotal ? Math.round(((aiTotal - aiFail) / aiTotal) * 100) : 100 },
      avgAiDurationMs: Math.round(avgDuration._avg.durationMs || 0),
      activeSessions,
      publicCodeShares,
      recentErrors
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/users - Get list of users with their subscriptions (search + pagination)
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10))
    const q = (req.query.q || '').trim()

    const where = q
      ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }
      : {}

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: { subscriptions: { where: { status: 'ACTIVE' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])

    res.json({ users, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/invoices - Get list of invoices (search + pagination)
router.get('/invoices', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10))
    const q = (req.query.q || '').trim()

    const where = q
      ? {
          OR: [
            { invoiceNumber: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { user: { name: { contains: q, mode: 'insensitive' } } }
          ]
        }
      : {}

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: { user: { select: { email: true, name: true } } },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ])

    res.json({ invoices, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/role - Toggle a user's role between USER and ADMIN
router.post('/users/:id/role', validateParams(), async (req, res, next) => {
  try {
    const { id } = req.params
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan' })
    if (target.id === req.user.id) return res.status(400).json({ error: 'Tidak bisa mengubah peran diri sendiri' })

    const nextRole = target.role === 'ADMIN' ? 'USER' : 'ADMIN'
    const updated = await prisma.user.update({ where: { id }, data: { role: nextRole } })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_USER_ROLE',
        details: `Set role of ${target.email} to ${nextRole}`,
        ipAddress: req.ip
      }
    })

    res.json({ id: updated.id, role: updated.role })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/reset-quota - Reset a user's daily quota counters
router.post('/users/:id/reset-quota', validateParams(), async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await prisma.planSubscription.updateMany({
      where: { userId: id, status: 'ACTIVE' },
      data: { quotaUsedToday: 0, codeQuotaUsedToday: 0, lastQuotaReset: new Date() }
    })
    if (result.count === 0) return res.status(404).json({ error: 'Langganan aktif tidak ditemukan' })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'RESET_USER_QUOTA',
        details: `Reset daily quota for user ${id}`,
        ipAddress: req.ip
      }
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/users/:id/subscription - Manually edit user's subscription
router.post('/users/:id/subscription', validateParams(), validate(updateSubscriptionSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { planType } = req.body

    const limits = {
      FREE: 1,
      PRO: 5,
      PRO_MAX: 200
    }

    const prdLimit = limits[planType]

    // Set active subscription to cancelled/inactive
    await prisma.planSubscription.updateMany({
      where: { userId: id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    })

    // Create new active subscription
    const newSub = await prisma.planSubscription.create({
      data: {
        userId: id,
        planType,
        status: 'ACTIVE',
        prdQuota: prdLimit,
        lastQuotaReset: new Date()
      }
    })

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_USER_SUBSCRIPTION',
        details: `Updated subscription of user ${id} to ${planType}`
      }
    })

    res.json(newSub)
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/audit-logs - Fetch latest audit logs (paginated)
router.get('/audit-logs', async (req, res, next) => {
  try {
    const action = String(req.query.action || '').trim()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50))
    const where = action ? { action: { contains: action, mode: 'insensitive' } } : {}
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } }
      })
    ])
    res.json({ items: logs, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/ai-logs - Fetch latest AI request logs (paginated)
router.get('/ai-logs', async (req, res, next) => {
  try {
    const success = req.query.success
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50))
    const where = success === 'true' ? { success: true } : success === 'false' ? { success: false } : {}
    const [total, logs] = await Promise.all([
      prisma.aiRequestLog.count({ where }),
      prisma.aiRequestLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } }
      })
    ])
    res.json({ items: logs, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  } catch (err) {
    next(err)
  }
})

router.get('/audit-logs.csv', async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } }
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"')
    res.send(csv([
      ['createdAt', 'user', 'action', 'details', 'ipAddress'],
      ...logs.map((l) => [l.createdAt.toISOString(), l.user?.email || '', l.action, l.details || '', l.ipAddress || ''])
    ]))
  } catch (err) {
    next(err)
  }
})

router.get('/ai-logs.csv', async (req, res, next) => {
  try {
    const logs = await prisma.aiRequestLog.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } }
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="ai-logs.csv"')
    res.send(csv([
      ['createdAt', 'user', 'modelUsed', 'promptTokens', 'completionTokens', 'durationMs', 'success', 'errorMessage'],
      ...logs.map((l) => [l.createdAt.toISOString(), l.user?.email || '', l.modelUsed, l.promptTokens || 0, l.completionTokens || 0, l.durationMs || 0, l.success, l.errorMessage || ''])
    ]))
  } catch (err) {
    next(err)
  }
})

// ========== Admin AI Keys Management ==========

function publicAdminKey(k) {
  return {
    id: k.id,
    provider: k.provider,
    label: k.label,
    baseUrl: k.baseUrl,
    model: k.model,
    keyMasked: maskSecret(decryptSecret(k.apiKey)),
    isActive: k.isActive,
    totalRequests: k.totalRequests,
    totalTokens: k.totalTokens,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  }
}

// GET /api/admin/ai-keys - List all admin AI keys
router.get('/ai-keys', async (req, res, next) => {
  try {
    const keys = await prisma.adminAiKey.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(keys.map(publicAdminKey))
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/ai-keys - Create new admin AI key
router.post('/ai-keys', validate(adminAiKeySchema), async (req, res, next) => {
  try {
    const { provider, label, baseUrl, apiKey, model, isActive } = req.body
    const safeBaseUrl = normalizeAiBaseUrl(baseUrl)
    const created = await prisma.adminAiKey.create({
      data: {
        provider: provider.trim(),
        label: label.trim(),
        baseUrl: safeBaseUrl,
        apiKey: encryptSecret(apiKey.trim()),
        model: model.trim(),
        isActive: isActive ?? true,
      }
    })
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'CREATE_ADMIN_AI_KEY', details: `Created admin AI key: ${label} (${provider}/${model})`, ipAddress: req.ip }
    })
    res.json(publicAdminKey(created))
  } catch (err) {
    next(err)
  }
})

// PUT /api/admin/ai-keys/:id - Update admin AI key
router.put('/ai-keys/:id', validateParams(), validate(updateAdminAiKeySchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await prisma.adminAiKey.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'AI key tidak ditemukan' })

    const data = {}
    const { provider, label, baseUrl, apiKey, model, isActive } = req.body
    if (provider !== undefined) data.provider = provider.trim()
    if (label !== undefined) data.label = label.trim()
    if (baseUrl !== undefined) data.baseUrl = normalizeAiBaseUrl(baseUrl)
    if (model !== undefined) data.model = model.trim()
    if (isActive !== undefined) data.isActive = isActive
    if (apiKey) data.apiKey = encryptSecret(apiKey.trim())

    const updated = await prisma.adminAiKey.update({ where: { id }, data })
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'UPDATE_ADMIN_AI_KEY', details: `Updated admin AI key: ${updated.label}`, ipAddress: req.ip }
    })
    res.json(publicAdminKey(updated))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/admin/ai-keys/:id - Delete admin AI key
router.delete('/ai-keys/:id', validateParams(), async (req, res, next) => {
  try {
    const { id } = req.params
    const existing = await prisma.adminAiKey.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'AI key tidak ditemukan' })
    await prisma.adminAiKey.delete({ where: { id } })
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DELETE_ADMIN_AI_KEY', details: `Deleted admin AI key: ${existing.label}`, ipAddress: req.ip }
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/ai-keys/:id/test - Test admin AI key connection
router.post('/ai-keys/:id/test', validateParams(), adminTestLimiter, async (req, res, next) => {
  try {
    const { id } = req.params
    const key = await prisma.adminAiKey.findUnique({ where: { id } })
    if (!key) return res.status(404).json({ error: 'AI key tidak ditemukan' })
    const decrypted = decryptSecret(key.apiKey)
    if (!decrypted) return res.status(400).json({ ok: false, error: 'Gagal mendekripsi API key' })

    await (isAnthropic(key.provider) ? testAnthropic({ baseUrl: key.baseUrl, apiKey: decrypted, model: key.model }) : testOpenAI({ baseUrl: key.baseUrl, apiKey: decrypted, model: key.model }))
    res.json({ ok: true, message: 'Koneksi berhasil. Model siap dipakai.' })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// POST /api/admin/ai-keys/test-connection - Test connection before saving
router.post('/ai-keys/test-connection', adminTestLimiter, async (req, res, next) => {
  try {
    const { baseUrl, apiKey, model } = req.body || {}
    if (!baseUrl || !apiKey || !model) {
      return res.status(400).json({ ok: false, error: 'Base URL, API key, dan model wajib diisi.' })
    }
    const safeBaseUrl = normalizeAiBaseUrl(baseUrl)
    const prov = (req.body.provider || 'openai').trim().toLowerCase()
    await (isAnthropic(prov) ? testAnthropic({ baseUrl: safeBaseUrl, apiKey, model }) : testOpenAI({ baseUrl: safeBaseUrl, apiKey, model }))
    res.json({ ok: true, message: 'Koneksi berhasil. Model siap dipakai.' })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// GET /api/admin/ai-keys/:id/usage - Get usage stats for a specific admin AI key
router.get('/ai-keys/:id/usage', validateParams(), async (req, res, next) => {
  try {
    const { id } = req.params
    const key = await prisma.adminAiKey.findUnique({ where: { id } })
    if (!key) return res.status(404).json({ error: 'AI key tidak ditemukan' })
    res.json({
      totalRequests: key.totalRequests,
      totalTokens: key.totalTokens,
      lastUsedAt: key.lastUsedAt,
    })
  } catch (err) {
    next(err)
  }
})

export default router
