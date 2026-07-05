import { prisma } from '../db.js'
import { Prisma } from '@prisma/client'
import { sendQuotaWarning } from './email.js'
import { logError } from './logger.js'

const QUOTA_EXHAUSTED_MSG = 'Kuota harian Anda telah habis. Silakan upgrade paket atau tunggu reset kuota.'

const QUOTA_LIMITS = {
  FREE: { prd: 1, code: 100 },
  PRO: { prd: 5, code: 500 },
  PRO_MAX: { prd: 200, code: 2000 },
  ADMIN: { prd: 1000, code: 50000 }
}

export const UPGRADE_BONUS_CREDITS = {
  PRO: 100,
  PRO_MAX: 400
}

export function calculateCreditCost(content = '') {
  const charCount = typeof content === 'string' ? content.length : 0
  const cost = Math.max(1, Math.ceil(charCount / 20))
  return Math.min(100, cost)
}

export function getQuotaLimit(planType, kind) {
  const limits = QUOTA_LIMITS[planType] || QUOTA_LIMITS.FREE
  return limits[kind] || 0
}

export function getUpgradeBonusCredits(planType) {
  return UPGRADE_BONUS_CREDITS[planType] || 0
}

export function getEffectiveQuotaLimit(subscription, kind) {
  const base = getQuotaLimit(subscription?.planType, kind)
  if (kind !== 'code') return base
  return base + Math.max(0, subscription?.bonusCodeCredits || 0)
}

export function nextResetAt(planType, lastResetDate) {
  // Per PRD: quota is a DAILY allowance ("terpakai hari ini", reset "24 jam sekali").
  // Plans differ by their quota LIMIT (see QUOTA_LIMITS), not by reset cadence — so
  // every plan resets 24h after the last reset. `planType` is kept for signature
  // stability / future per-plan overrides.
  const lastReset = new Date(lastResetDate)
  const next = new Date(lastReset)
  next.setTime(next.getTime() + 24 * 60 * 60 * 1000)
  return next
}

/**
 * Gets or creates the active subscription for the user, checking for timezone-aware daily resets.
 */
export async function getActiveSubscription(userId) {
  let sub = await prisma.planSubscription.findFirst({
    where: { userId, status: 'ACTIVE' }
  })

  // Fallback: If no subscription, create a FREE subscription for the user
  if (!sub) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const role = user?.role || 'USER'
    const planType = role === 'ADMIN' ? 'ADMIN' : 'FREE'
    
    try {
      sub = await prisma.planSubscription.create({
        data: {
          userId,
          planType,
          status: 'ACTIVE',
          prdQuota: getQuotaLimit(planType, 'prd'),
          lastQuotaReset: new Date()
        }
      })
    } catch (err) {
      // Race condition: another request created the subscription concurrently
      sub = await prisma.planSubscription.findFirst({
        where: { userId, status: 'ACTIVE' }
      })
    }
  }

  // Check if reset is needed based on planType intervals
  const now = new Date()
  const nextReset = nextResetAt(sub.planType, sub.lastQuotaReset)

  if (now >= nextReset) {
    // Perform reset
    sub = await prisma.planSubscription.update({
      where: { id: sub.id },
      data: {
        quotaUsedToday: 0,
        codeQuotaUsedToday: 0,
        lastQuotaReset: new Date()
      }
    })
  }

  return sub
}

/**
 * Atomically claims quota for the user.
 * @param {string} userId - ID of user
 * @param {string} kind - 'prd' or 'code'
 * @param {number} amount - quota units or credits to deduct
 */
export async function claimQuota(userId, kind, amount = 1) {
  const sub = await getActiveSubscription(userId)
  if (!sub || sub.status !== 'ACTIVE') {
    return { allowed: false, remaining: 0, limit: 0, planType: 'NONE' }
  }

  const limit = getEffectiveQuotaLimit(sub, kind)
  const field = kind === 'prd' ? 'quotaUsedToday' : 'codeQuotaUsedToday'
  const usedToday = sub[field]

  if (usedToday + amount > limit) {
    return { allowed: false, remaining: Math.max(0, limit - usedToday), limit, planType: sub.planType }
  }

  // Atomic update: only update if current used quota is less than or equal to limit - amount
  const updatedCount = await prisma.planSubscription.updateMany({
    where: {
      id: sub.id,
      [field]: { lte: limit - amount }
    },
    data: {
      [field]: { increment: amount }
    }
  })

  if (updatedCount.count === 0) {
    // Parallel request beat this one and consumed the last quota
    const fresh = await prisma.planSubscription.findUnique({ where: { id: sub.id } })
    const freshUsed = fresh ? fresh[field] : limit
    return { allowed: false, remaining: Math.max(0, limit - freshUsed), limit, planType: sub.planType }
  }

  // Record usage log
  prisma.usageLog.create({
    data: {
      userId,
      action: `CLAIM_QUOTA_${kind.toUpperCase()}`,
      details: `Claimed ${amount} quota/credits for ${kind}. New usage: ${usedToday + amount}/${limit}`
    }
  }).catch(err => logError('Usage Log', 'Failed to save log', err))

  const newUsed = usedToday + amount
  if (usedToday < Math.floor(limit * 0.8) && newUsed >= Math.floor(limit * 0.8)) {
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
      .then((u) => { if (u) sendQuotaWarning(u.email, sub.planType, newUsed, limit).catch((err) => logError('Quota', 'Gagal kirim quota warning', err)) })
      .catch((err) => logError('Quota', 'Gagal lookup user untuk quota warning', err))
  }

  return { allowed: true, remaining: Math.max(0, limit - usedToday - amount), limit, planType: sub.planType }
}

/**
 * Tries to claim quota for a user. If BYOK is active, quota is bypassed.
 * If quota is exhausted, sends a 429 response with error details via the provided
 * Express response object and returns `{ quotaClaimed: false }`.
 *
 * Usage in routes:
 *   const { quotaClaimed } = await tryClaimQuota(req, res, 'code', creditCost, customCfg)
 *   if (!quotaClaimed) return // response already sent
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} kind - 'prd' or 'code'
 * @param {number} [amount=1] - credit cost
 * @param {Object|null} [customCfg=null] - BYOK config (null = use built-in models)
 * @returns {Promise<{quotaClaimed: boolean}>}
 */
export async function tryClaimQuota(req, res, kind, amount = 1, customCfg = null) {
  if (customCfg) return { quotaClaimed: false }

  const quotaResult = await claimQuota(req.user.id, kind, amount)
  if (!quotaResult.allowed) {
    res.status(429).json({
      error: QUOTA_EXHAUSTED_MSG,
      remaining: quotaResult.remaining,
      limit: quotaResult.limit,
      planType: quotaResult.planType,
    })
    return { quotaClaimed: false }
  }
  return { quotaClaimed: true }
}

/**
 * Refunds a previously claimed quota in case of failure.
 * Uses atomic updateMany to avoid race conditions from stale reads.
 */
export async function refundQuota(userId, kind, amount = 1) {
  const field = kind === 'prd' ? 'quotaUsedToday' : 'codeQuotaUsedToday'

  // Atomic conditional decrement using parameterized query: never go below 0
  // Gunakan Prisma.$executeRaw (bukan $executeRawUnsafe) untuk parameter binding aman
  // Catatan: PostgreSQL case-sensitive identifiers WAJIB pakai double quotes
  const fieldName = kind === 'prd' ? 'quotaUsedToday' : 'codeQuotaUsedToday'
  const quoted = `"${fieldName}"`
  const result = await prisma.$executeRaw(
    Prisma.sql`UPDATE "PlanSubscription" SET ${Prisma.raw(quoted)} = GREATEST(0, ${Prisma.raw(quoted)} - ${amount}) WHERE "userId" = ${userId} AND "status" = 'ACTIVE'`
  )

  if (result > 0) {
    prisma.usageLog.create({
      data: {
        userId,
        action: `REFUND_QUOTA_${kind.toUpperCase()}`,
        details: `Refunded ${amount} quota/credits for ${kind} due to failure.`
      }
    }).catch(err => logError('Usage Log', 'Failed to save log', err))
  }
}
