import { Router } from 'express'

import { prisma } from '../db.js'
import { AppError } from '../middleware/errorHandler.js'
import { fetchWithTimeout } from '../utils/fetch.js'
import { getQuotaLimit } from '../utils/quota.js'
import {
  buildPakasirStatusUrl,
  extractPakasirAmount,
  getPakasirStatusInfo,
  parsePakasirOrder
} from '../utils/pakasir.js'

const router = Router()

router.get('/pakasir/webhook', (req, res) => {
  res.json({
    ok: true,
    service: 'pakasir-webhook',
    configured: Boolean(process.env.PAKASIR_SLUG && process.env.PAKASIR_API_KEY)
  })
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

    const slug = process.env.PAKASIR_SLUG
    const apiKey = process.env.PAKASIR_API_KEY
    if (!slug || !apiKey) {
      throw new AppError('Konfigurasi Pakasir belum lengkap di server.', 500)
    }

    const verificationUrl = buildPakasirStatusUrl({ slug, apiKey, amount, orderId })
    const verified = await fetchWithTimeout(verificationUrl, { headers: { Accept: 'application/json' } }, { timeoutMs: 12_000 })
    const verificationJson = await readJsonSafely(verified)

    if (!verified.ok) {
      throw new AppError(verificationJson?.message || 'Transaksi tidak ditemukan di Pakasir.', 400)
    }

    const statusInfo = getPakasirStatusInfo(verificationJson)
    if (!statusInfo.paid) {
      return res.status(202).json({
        ok: true,
        paid: false,
        status: statusInfo.status || 'PENDING'
      })
    }

    const result = await activatePaidPlan({ userId, planType, amount, orderId, ipAddress: req.ip })
    res.json({ ok: true, paid: true, duplicate: result.duplicate, subscriptionId: result.subscriptionId })
  } catch (err) {
    next(err)
  }
})

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

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) throw new AppError('User untuk order_id Pakasir tidak ditemukan.', 400)

    const existingInvoice = await tx.invoice.findUnique({ where: { invoiceNumber } })
    if (existingInvoice?.status === 'PAID') {
      const activeSub = await tx.planSubscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      })
      return { duplicate: true, subscriptionId: activeSub?.id || null }
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
        details: `Activated ${planType} from Pakasir order ${orderId}`,
        ipAddress
      }
    })

    return { duplicate: false, subscriptionId: subscription.id }
  })
}

export default router
