import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPakasirStatusUrl,
  buildPakasirPaymentUrl,
  extractPakasirAmount,
  getPakasirStatusInfo,
  isPakasirSandboxMode,
  normalizePlanType,
  parsePakasirOrder
} from '../src/utils/pakasir.js'

test('normalizes supported Pakasir plan names', () => {
  assert.equal(normalizePlanType('pro'), 'PRO')
  assert.equal(normalizePlanType('pro-max'), 'PRO_MAX')
  assert.equal(normalizePlanType('PRO MAX'), 'PRO_MAX')
  assert.equal(normalizePlanType('free'), null)
})

test('parses Pakasir order id formats', () => {
  assert.deepEqual(parsePakasirOrder({ order_id: 'PRO_user123_123456' }), {
    orderId: 'PRO_user123_123456',
    userId: 'user123',
    planType: 'PRO'
  })

  assert.deepEqual(parsePakasirOrder({ order_id: 'ARISEHASH_PRO_MAX_user123_123456' }), {
    orderId: 'ARISEHASH_PRO_MAX_user123_123456',
    userId: 'user123',
    planType: 'PRO_MAX'
  })

  assert.deepEqual(parsePakasirOrder({ order_id: 'arisexhash:PRO:user123:123456' }), {
    orderId: 'arisexhash:PRO:user123:123456',
    userId: 'user123',
    planType: 'PRO'
  })
})

test('explicit Pakasir payload fields override order parsing', () => {
  assert.deepEqual(parsePakasirOrder({
    order_id: 'ORDER-1',
    user_id: 'user456',
    plan_type: 'pro max'
  }), {
    orderId: 'ORDER-1',
    userId: 'user456',
    planType: 'PRO_MAX'
  })
})

test('extracts numeric Pakasir amount', () => {
  assert.equal(extractPakasirAmount({ amount: 'Rp 50.000' }), 50000)
  assert.equal(extractPakasirAmount({ gross_amount: '75000' }), 75000)
  assert.equal(extractPakasirAmount({ amount: 'gratis' }), null)
})

test('builds Pakasir transaction-status URL', () => {
  const url = buildPakasirStatusUrl({
    slug: 'arisexhash',
    apiKey: 'secret',
    amount: 10000,
    orderId: 'PRO_user123_1'
  })

  assert.equal(url.origin, 'https://app.pakasir.com')
  assert.equal(url.pathname, '/api/transaction-status')
  assert.equal(url.searchParams.get('project'), 'arisexhash')
  assert.equal(url.searchParams.get('amount'), '10000')
  assert.equal(url.searchParams.get('order_id'), 'PRO_user123_1')
  assert.equal(url.searchParams.get('api_key'), 'secret')
})

test('builds Pakasir payment URL', () => {
  const url = buildPakasirPaymentUrl({
    slug: 'arisexhash',
    amount: 20000,
    orderId: 'PRO_user123_1',
    redirectUrl: 'https://www.arisexhash.xyz/app/upgrade'
  })

  assert.equal(url.origin, 'https://app.pakasir.com')
  assert.equal(url.pathname, '/pay/arisexhash/20000')
  assert.equal(url.searchParams.get('order_id'), 'PRO_user123_1')
  assert.equal(url.searchParams.get('redirect'), 'https://www.arisexhash.xyz/app/upgrade')
})

test('adds sandbox marker to Pakasir payment URL when sandbox mode is enabled', () => {
  const previous = process.env.PAKASIR_MODE
  process.env.PAKASIR_MODE = 'sandbox'
  try {
    assert.equal(isPakasirSandboxMode(), true)
    const url = buildPakasirPaymentUrl({
      slug: 'arisexhash',
      amount: 20000,
      orderId: 'PRO_user123_1'
    })
    assert.equal(url.searchParams.get('sandbox'), '1')
  } finally {
    if (previous === undefined) delete process.env.PAKASIR_MODE
    else process.env.PAKASIR_MODE = previous
  }
})

test('detects paid Pakasir verification responses', () => {
  assert.deepEqual(getPakasirStatusInfo({ data: { status: 'paid' } }), { status: 'paid', paid: true })
  assert.deepEqual(getPakasirStatusInfo({ data: { payment_status: 'pending' } }), { status: 'pending', paid: false })
  assert.deepEqual(getPakasirStatusInfo({ data: { paid_at: '2026-07-05T00:00:00Z' } }), { status: null, paid: true })
  assert.deepEqual(getPakasirStatusInfo({ transaction: { completed_at: '2026-07-05T00:00:00Z' } }), { status: null, paid: true })
})
