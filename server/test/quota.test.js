import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCreditCost,
  getEffectiveQuotaLimit,
  getQuotaLimit,
  getUpgradeBonusCredits,
  nextResetAt,
  tryClaimQuota,
} from '../src/utils/quota.js'

/* ── Helpers ──────────────────────────────────────────────────────────── */

function mockReq(userId = 'user-1') {
  return { user: { id: userId } }
}

function mockRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (data) => { res.body = data; return res }
  return res
}

/* ── calculateCreditCost ──────────────────────────────────────────────── */

test('calculateCreditCost returns 1 for empty or missing content', () => {
  assert.equal(calculateCreditCost(''), 1)
  assert.equal(calculateCreditCost(), 1)
  assert.equal(calculateCreditCost(null), 1)
  assert.equal(calculateCreditCost(undefined), 1)
})

test('calculateCreditCost scales with content length', () => {
  // 20 chars → ceil(20/20) = 1
  assert.equal(calculateCreditCost('x'.repeat(20)), 1)
  // 40 chars → ceil(40/20) = 2
  assert.equal(calculateCreditCost('x'.repeat(40)), 2)
  // 2000 chars → ceil(2000/20) = 100
  assert.equal(calculateCreditCost('x'.repeat(2000)), 100)
})

test('calculateCreditCost caps at 100 even for very long content', () => {
  assert.equal(calculateCreditCost('x'.repeat(20_000)), 100)
  assert.equal(calculateCreditCost('x'.repeat(100_000)), 100)
})

/* ── getQuotaLimit ────────────────────────────────────────────────────── */

test('getQuotaLimit returns correct limits for each plan type', () => {
  assert.equal(getQuotaLimit('FREE', 'prd'), 1)
  assert.equal(getQuotaLimit('FREE', 'code'), 100)
  assert.equal(getQuotaLimit('PRO', 'prd'), 5)
  assert.equal(getQuotaLimit('PRO', 'code'), 500)
  assert.equal(getQuotaLimit('PRO_MAX', 'prd'), 200)
  assert.equal(getQuotaLimit('PRO_MAX', 'code'), 2000)
  assert.equal(getQuotaLimit('ADMIN', 'prd'), 1000)
  assert.equal(getQuotaLimit('ADMIN', 'code'), 50000)
})

test('getQuotaLimit falls back to FREE for unknown plan types', () => {
  assert.equal(getQuotaLimit('UNKNOWN', 'prd'), 1)
  assert.equal(getQuotaLimit('UNKNOWN_PLAN', 'code'), 100)
})

test('getQuotaLimit returns 0 for unknown quota kinds', () => {
  assert.equal(getQuotaLimit('FREE', 'unknown'), 0)
  assert.equal(getQuotaLimit('PRO', 'invalid'), 0)
})

test('upgrade bonus credits are added to effective code quota only', () => {
  assert.equal(getUpgradeBonusCredits('PRO'), 100)
  assert.equal(getUpgradeBonusCredits('PRO_MAX'), 400)
  assert.equal(getUpgradeBonusCredits('FREE'), 0)

  const sub = { planType: 'PRO', bonusCodeCredits: 100 }
  assert.equal(getEffectiveQuotaLimit(sub, 'code'), 600)
  assert.equal(getEffectiveQuotaLimit(sub, 'prd'), 5)
})

/* ── nextResetAt ──────────────────────────────────────────────────────── */

test('nextResetAt adds 24 hours to last reset date', () => {
  const base = new Date('2026-06-01T00:00:00Z')
  const next = nextResetAt('FREE', base)
  assert.equal(next.getTime(), base.getTime() + 24 * 60 * 60 * 1000)
})

test('nextResetAt uses same 24h logic for all plan types', () => {
  const base = new Date('2026-06-15T12:30:00Z')
  const nextFree = nextResetAt('FREE', base)
  const nextPro = nextResetAt('PRO', base)
  const nextAdmin = nextResetAt('ADMIN', base)
  assert.equal(nextFree.getTime(), nextPro.getTime())
  assert.equal(nextPro.getTime(), nextAdmin.getTime())
})

/* ── tryClaimQuota (BYOK bypass only — no DB dependency) ──────────────── */

test('tryClaimQuota bypasses when customCfg is truthy (BYOK)', async () => {
  const req = mockReq()
  const res = mockRes()
  const result = await tryClaimQuota(req, res, 'code', 1, {})

  assert.deepEqual(result, { quotaClaimed: false })
  // BYOK bypass is silent — no response sent
  assert.equal(res.statusCode, null)
  assert.equal(res.body, null)
})

test('tryClaimQuota bypasses with any truthy customCfg', async () => {
  const req = mockReq()
  const res = mockRes()

  const r1 = await tryClaimQuota(req, res, 'code', 1, { apiKey: 'sk-xxx' })
  assert.deepEqual(r1, { quotaClaimed: false })
  assert.equal(res.statusCode, null)

  const r2 = await tryClaimQuota(req, res, 'code', 1, [])
  assert.deepEqual(r2, { quotaClaimed: false })

  const r3 = await tryClaimQuota(req, res, 'code', 1, true)
  assert.deepEqual(r3, { quotaClaimed: false })
})
