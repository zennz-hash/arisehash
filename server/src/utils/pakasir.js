export const PAKASIR_API_BASE = 'https://app.pakasir.com/api'
export const PAKASIR_PAY_BASE = 'https://app.pakasir.com/pay'

export const PAKASIR_PLAN_TYPES = new Set(['PRO', 'PRO_MAX'])

export const PAKASIR_PLANS = {
  PRO: {
    name: 'Starter',
    amount: 20_000,
    bonusCredits: 100
  },
  PRO_MAX: {
    name: 'Pro Max',
    amount: 75_000,
    bonusCredits: 400
  }
}

const PAID_STATUSES = new Set([
  'paid',
  'success',
  'successful',
  'settlement',
  'settled',
  'capture',
  'completed',
  'complete',
  'berhasil',
  'sukses',
  'lunas'
])

export function normalizePlanType(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (normalized === 'PROMAX' || normalized === 'MAX') return 'PRO_MAX'
  if (PAKASIR_PLAN_TYPES.has(normalized)) return normalized
  return null
}

export function firstString(source, keys) {
  if (!source || typeof source !== 'object') return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

export function parsePakasirOrder(payload = {}) {
  const orderId = firstString(payload, ['order_id', 'orderId', 'invoice_number', 'invoiceNumber'])
  const explicitUserId = firstString(payload, ['userId', 'user_id', 'userid'])
  const explicitPlanType = normalizePlanType(firstString(payload, ['planType', 'plan_type', 'plan', 'package', 'paket']))

  if (explicitUserId && explicitPlanType) {
    return { orderId, userId: explicitUserId, planType: explicitPlanType }
  }

  if (!orderId) return { orderId: null, userId: explicitUserId, planType: explicitPlanType }

  const parsed = parseDelimitedOrder(orderId, /[:|]/) || parseDelimitedOrder(orderId, /_/)
  return {
    orderId,
    userId: explicitUserId || parsed?.userId || null,
    planType: explicitPlanType || parsed?.planType || null
  }
}

function parseDelimitedOrder(orderId, delimiter) {
  const parts = orderId.split(delimiter).map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null

  if (/^ARISEX?HASH$/i.test(parts[0])) parts.shift()

  let planType = null
  let userIndex = 1

  if (parts[0]?.toUpperCase() === 'PRO' && parts[1]?.toUpperCase() === 'MAX') {
    planType = 'PRO_MAX'
    userIndex = 2
  } else {
    planType = normalizePlanType(parts[0])
  }

  const userId = parts[userIndex]
  if (!planType || !userId) return null
  return { planType, userId }
}

export function extractPakasirAmount(payload = {}) {
  const raw = firstString(payload, ['amount', 'total', 'gross_amount', 'nominal'])
  if (!raw) return null
  const value = Number(String(raw).replace(/[^\d]/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export function buildPakasirStatusUrl({ slug, apiKey, amount, orderId }) {
  const url = new URL('/api/transaction-status', PAKASIR_API_BASE)
  url.searchParams.set('project', slug)
  url.searchParams.set('amount', String(amount))
  url.searchParams.set('order_id', orderId)
  url.searchParams.set('api_key', apiKey)
  return url
}

export function buildPakasirPaymentUrl({ slug, amount, orderId, redirectUrl }) {
  const url = new URL(`${PAKASIR_PAY_BASE}/${encodeURIComponent(slug)}/${encodeURIComponent(String(amount))}`)
  url.searchParams.set('order_id', orderId)
  if (redirectUrl) url.searchParams.set('redirect', redirectUrl)
  return url
}

export function getPakasirStatusInfo(responseJson) {
  const data = responseJson?.data ?? responseJson
  const candidates = [
    data?.status,
    data?.payment_status,
    data?.transaction_status,
    data?.state,
    data?.transaction?.status,
    data?.transaction?.payment_status,
    data?.payment?.status,
    responseJson?.status,
    responseJson?.payment_status,
    responseJson?.transaction_status
  ]

  const status = candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || null
  const normalized = status?.toLowerCase() || null
  const hasPaidTimestamp = Boolean(
    data?.paid_at ||
    data?.paidAt ||
    data?.completed_at ||
    data?.settlement_at ||
    data?.payment?.paid_at ||
    data?.transaction?.paid_at ||
    data?.transaction?.completed_at ||
    data?.transaction?.settlement_at
  )
  const settled = data?.settled === true || data?.transaction?.settled === true

  return {
    status,
    paid: settled || hasPaidTimestamp || (normalized ? PAID_STATUSES.has(normalized) : false)
  }
}
