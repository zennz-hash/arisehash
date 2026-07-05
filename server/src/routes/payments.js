import { Router } from 'express'

import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { fetchWithTimeout } from '../utils/fetch.js'
import { getQuotaLimit, getUpgradeBonusCredits } from '../utils/quota.js'
import {
  buildPakasirStatusUrl,
  buildPakasirPaymentUrl,
  extractPakasirAmount,
  getPakasirStatusInfo,
  PAKASIR_PLANS,
  parsePakasirOrder,
  normalizePlanType,
  isPakasirSandboxMode
} from '../utils/pakasir.js'

const router = Router()

router.get('/pakasir/webhook', (req, res) => {
  res.json({
    ok: true,
    service: 'pakasir-webhook',
    configured: Boolean(process.env.PAKASIR_SLUG && process.env.PAKASIR_API_KEY)
  })
})

router.post('/pakasir/checkout', requireAuth, async (req, res, next) => {
  try {
    const planType = normalizePlanType(req.body?.planType)
    const plan = planType ? PAKASIR_PLANS[planType] : null
    if (!plan) throw new AppError('Plan pembayaran tidak valid.', 400)

    const slug = process.env.PAKASIR_SLUG
    if (!slug) throw new AppError('Slug Pakasir belum dikonfigurasi di server.', 500)

    const orderId = `${planType}_${req.user.id}_${Date.now()}`
    const redirectUrl = `${getClientOrigin(req)}/app/upgrade?order_id=${encodeURIComponent(orderId)}`
    const paymentUrl = buildPakasirPaymentUrl({
      slug,
      amount: plan.amount,
      orderId,
      redirectUrl
    }).toString()

    const transaction = await createPakasirTransaction({ slug, amount: plan.amount, orderId })
    const sandbox = Boolean(transaction?.transaction?.is_sandbox || transaction?.data?.is_sandbox || isPakasirSandboxMode())

    res.json({
      orderId,
      planType,
      planName: plan.name,
      amount: plan.amount,
      bonusCredits: plan.bonusCredits,
      sandbox,
      paymentUrl,
      statusUrl: `/api/payment/pakasir/status?order_id=${encodeURIComponent(orderId)}&amount=${plan.amount}`
    })
  } catch (err) {
    next(err)
  }
})

router.get('/pakasir/status', requireAuth, async (req, res, next) => {
  try {
    const orderId = String(req.query.order_id || req.query.orderId || '').trim()
    const amount = extractPakasirAmount(req.query)
    if (!orderId || !amount) throw new AppError('order_id dan amount wajib diisi.', 400)

    const { userId, planType } = parsePakasirOrder({ order_id: orderId })
    if (userId !== req.user.id) throw new AppError('Order pembayaran tidak cocok dengan user saat ini.', 403)
    if (!planType || !PAKASIR_PLANS[planType]) throw new AppError('Plan pembayaran tidak valid.', 400)

    const verificationJson = await verifyPakasirTransaction({ amount, orderId, allowPending: true })
    const statusInfo = getPakasirStatusInfo(verificationJson)
    if (!statusInfo.paid) {
      return res.json({ ok: true, paid: false, status: statusInfo.status || 'PENDING' })
    }

    const result = await activatePaidPlan({ userId, planType, amount, orderId, ipAddress: req.ip })
    res.json({
      ok: true,
      paid: true,
      status: statusInfo.status || 'PAID',
      duplicate: result.duplicate,
      planType,
      bonusCredits: result.bonusCredits,
      subscriptionId: result.subscriptionId
    })
  } catch (err) {
    next(err)
  }
})

router.post('/pakasir/webhook', async (req, res, next) => {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) }
    const { orderId, userId, planType } = parsePakasirOrder(payload)
    const amount = extractPakasirAmount(payload)

    if (!orderId || !amount) {
      throw new AppError('Payload Pakasir harus berisi order_id dan amount.', 400)
    }
    if (!userId || !planType) {
      throw new AppError('order_id Pakasir harus memakai format PRO_<USER_ID>_<timestamp> atau PRO_MAX_<USER_ID>_<timestamp>.', 400)
    }

    const verificationJson = await verifyPakasirTransaction({ amount, orderId })

    const statusInfo = getPakasirStatusInfo(verificationJson)
    if (!statusInfo.paid) {
      return res.status(202).json({
        ok: true,
        paid: false,
        status: statusInfo.status || 'PENDING'
      })
    }

    const result = await activatePaidPlan({ userId, planType, amount, orderId, ipAddress: req.ip })
    res.json({
      ok: true,
      paid: true,
      duplicate: result.duplicate,
      subscriptionId: result.subscriptionId,
      planType,
      bonusCredits: result.bonusCredits
    })
  } catch (err) {
    next(err)
  }
})

function getClientOrigin(req) {
  const origin = process.env.CLIENT_ORIGIN
    ?.split(',')
    .map((value) => value.trim())
    .find((value) => value && value !== '*')
  if (origin) return origin
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return host ? `${proto}://${host}` : 'https://arisehash.vercel.app'
}

async function createPakasirTransaction({ slug, amount, orderId }) {
  const payload = { project: slug, amount, order_id: orderId }
  if (isPakasirSandboxMode()) payload.is_sandbox = true

  const response = await fetchWithTimeout(`${process.env.PAKASIR_API_BASE || 'https://app.pakasir.com/api'}/transactions`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, { timeoutMs: 12_000 })
  const json = await readJsonSafely(response)
  if (!response.ok) throw new AppError(json?.message || 'Gagal membuat transaksi Pakasir.', 502)
  return json
}

async function verifyPakasirTransaction({ amount, orderId, allowPending = false }) {
  const slug = process.env.PAKASIR_SLUG
  const apiKey = process.env.PAKASIR_API_KEY
  if (!slug || !apiKey) {
    throw new AppError('Konfigurasi Pakasir belum lengkap di server.', 500)
  }

  const verificationUrl = buildPakasirStatusUrl({ slug, apiKey, amount, orderId })
  const verified = await fetchWithTimeout(verificationUrl, { headers: { Accept: 'application/json' } }, { timeoutMs: 12_000 })
  const verificationJson = await readJsonSafely(verified)

  if (!verified.ok && allowPending && isPendingPakasirResponse(verificationJson)) {
    return { data: { status: 'pending' }, message: verificationJson?.message }
  }

  if (!verified.ok) {
    throw new AppError(verificationJson?.message || 'Transaksi tidak ditemukan di Pakasir.', 400)
  }
  return verificationJson
}

function isPendingPakasirResponse(json) {
  const message = String(json?.message || '').toLowerCase()
  return message.includes('dana belum masuk') || message.includes('periksa kembali')
}

async function readJsonSafely(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { message: text }
  }
}

async function activatePaidPlan({ userId, planType, amount, orderId, ipAddress }) {
  const invoiceNumber = `PAKASIR-${orderId}`
  const activeUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const prdQuota = getQuotaLimit(planType, 'prd')
  const bonusCredits = getUpgradeBonusCredits(planType)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw new AppError('User untuk order_id Pakasir tidak ditemukan.', 400)

    const existingInvoice = await tx.invoice.findUnique({ where: { invoiceNumber } })
    if (existingInvoice?.status === 'PAID') {
      const activeSub = await tx.planSubscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, bonusCodeCredits: true }
      })
      return { duplicate: true, subscriptionId: activeSub?.id || null, bonusCredits: activeSub?.bonusCodeCredits || bonusCredits }
    }

    await tx.planSubscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    })

    const subscription = await tx.planSubscription.create({
      data: {
        userId,
        planType,
        status: 'ACTIVE',
        prdQuota,
        bonusCodeCredits: bonusCredits,
        lastQuotaReset: new Date(),
        activeUntil
      },
      select: { id: true }
    })

    if (existingInvoice) {
      await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: { userId, planType, amount, status: 'PAID', paidAt: new Date() }
      })
    } else {
      await tx.invoice.create({
        data: { invoiceNumber, userId, planType, amount, status: 'PAID', paidAt: new Date() }
      })
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: 'PAKASIR_WEBHOOK_PAID',
        details: `Activated ${planType} from Pakasir order ${orderId} with ${bonusCredits} bonus code credits`,
        ipAddress
      }
    })

    await tx.usageLog.create({
      data: {
        userId,
        action: 'CLAIM_UPGRADE_BONUS_CREDITS',
        details: `Granted ${bonusCredits} bonus code credits for ${planType} via Pakasir order ${orderId}.`
      }
    })

    return { duplicate: false, subscriptionId: subscription.id, bonusCredits }
  })
}

export default router
