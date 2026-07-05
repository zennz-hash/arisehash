import { Router } from 'express'
import { getActiveSubscription, getQuotaLimit, nextResetAt } from '../utils/quota.js'
import { requireAuth } from '../auth.js'
import { prisma } from '../db.js'
import { costOf, labelFor } from '../utils/pricing.js'

const router = Router()

// GET /api/quota - Fetch current user's active plan subscription and remaining quotas
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sub = await getActiveSubscription(req.user.id)
    const prdLimit = getQuotaLimit(sub.planType, 'prd')
    const codeLimit = getQuotaLimit(sub.planType, 'code')
    res.json({
      planType: sub.planType,
      status: sub.status,
      prdQuota: prdLimit,
      codeQuota: codeLimit,
      quotaUsedToday: sub.quotaUsedToday,
      codeQuotaUsedToday: sub.codeQuotaUsedToday,
      remaining: {
        prd: Math.max(0, prdLimit - sub.quotaUsedToday),
        chatStandard: Math.max(0, codeLimit - sub.codeQuotaUsedToday),
        code: Math.max(0, codeLimit - sub.codeQuotaUsedToday),
        maxThinking: Math.max(0, codeLimit - sub.codeQuotaUsedToday)
      },
      usage: {
        prd: sub.quotaUsedToday,
        chatStandard: sub.codeQuotaUsedToday,
        code: sub.codeQuotaUsedToday,
        maxThinking: sub.codeQuotaUsedToday
      },
      limits: {
        prd: prdLimit,
        chatStandard: codeLimit,
        code: codeLimit,
        maxThinking: codeLimit
      },
      lastQuotaReset: sub.lastQuotaReset,
      nextResetAt: nextResetAt(sub.planType, sub.lastQuotaReset),
      activeUntil: sub.activeUntil
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/quota/usage - Personal usage summary + recent activity (last 7 days)
router.get('/usage', requireAuth, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const costSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [logs, prdCount, codeCount, recent, aiLogs] = await Promise.all([
      prisma.usageLog.findMany({
        where: { userId: req.user.id, createdAt: { gte: since } },
        select: { action: true, createdAt: true }
      }),
      prisma.usageLog.count({ where: { userId: req.user.id, action: 'CLAIM_QUOTA_PRD' } }),
      prisma.usageLog.count({ where: { userId: req.user.id, action: 'CLAIM_QUOTA_CODE' } }),
      prisma.usageLog.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { action: true, details: true, createdAt: true }
      }),
      prisma.aiRequestLog.findMany({
        where: { userId: req.user.id, success: true, createdAt: { gte: costSince } },
        select: { modelUsed: true, promptTokens: true, completionTokens: true }
      })
    ])

    // Build a 7-day daily series of claims.
    const days = 7
    const series = new Array(days).fill(0)
    const now = new Date(); now.setHours(0, 0, 0, 0)
    logs.forEach((l) => {
      if (!l.action.startsWith('CLAIM_QUOTA')) return
      const d = new Date(l.createdAt); d.setHours(0, 0, 0, 0)
      const diff = Math.round((now - d) / 86400000)
      if (diff >= 0 && diff < days) series[days - 1 - diff] += 1
    })

    // Estimasi biaya pemakaian token (USD, 30 hari) — dikelompokkan per model.
    const byModel = new Map()
    let totalCost = 0, promptTokens = 0, completionTokens = 0
    aiLogs.forEach((l) => {
      const pt = l.promptTokens || 0
      const ct = l.completionTokens || 0
      const c = costOf(l.modelUsed, pt, ct)
      promptTokens += pt
      completionTokens += ct
      totalCost += c
      const key = labelFor(l.modelUsed)
      const cur = byModel.get(key) || { label: key, cost: 0, tokens: 0, requests: 0 }
      cur.cost += c; cur.tokens += pt + ct; cur.requests += 1
      byModel.set(key, cur)
    })
    const sorted = [...byModel.values()].sort((a, b) => b.cost - a.cost)
    // Maksimal 5 segmen; sisanya digabung jadi "Lainnya".
    let breakdown = sorted
    if (sorted.length > 5) {
      const top = sorted.slice(0, 4)
      const rest = sorted.slice(4).reduce((a, m) => ({
        label: 'Lainnya', cost: a.cost + m.cost, tokens: a.tokens + m.tokens, requests: a.requests + m.requests
      }), { label: 'Lainnya', cost: 0, tokens: 0, requests: 0 })
      breakdown = [...top, rest]
    }
    const round = (n) => Math.round(n * 1e6) / 1e6
    const cost = {
      currency: 'USD',
      days: 30,
      total: round(totalCost),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      requests: aiLogs.length,
      breakdown: breakdown.map((b) => ({ ...b, cost: round(b.cost) }))
    }

    res.json({ totalPrd: prdCount, totalCode: codeCount, series, recent, cost })
  } catch (err) {
    next(err)
  }
})

export default router
