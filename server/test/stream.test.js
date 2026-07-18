import test from 'node:test'
import assert from 'node:assert/strict'
import { setSSEHeaders, startSSEHeartbeat, MAX_AI_RESPONSE_LENGTH } from '../src/utils/stream.js'

function mockRes() {
  const headers = {}
  const writes = []
  let flushed = false
  const res = {
    setHeader: (name, value) => { headers[name] = value },
    flushHeaders: () => { flushed = true },
    write: (data) => { writes.push(data); return true },
    getHeader: (name) => headers[name],
    wasFlushed: () => flushed,
    writes: () => writes,
    _headers: headers,
  }
  return res
}

test('MAX_AI_RESPONSE_LENGTH is 500_000', () => {
  assert.equal(MAX_AI_RESPONSE_LENGTH, 500_000)
})

test('setSSEHeaders sets all four SSE headers', () => {
  const res = mockRes()
  setSSEHeaders(res)

  assert.equal(res.getHeader('Content-Type'), 'text/event-stream; charset=utf-8')
  assert.equal(res.getHeader('Cache-Control'), 'no-cache, no-transform')
  assert.equal(res.getHeader('Connection'), 'keep-alive')
  assert.equal(res.getHeader('X-Accel-Buffering'), 'no')
})

test('setSSEHeaders calls flushHeaders', () => {
  const res = mockRes()
  setSSEHeaders(res)
  assert.equal(res.wasFlushed(), true)
})

test('setSSEHeaders works without flushHeaders (graceful fallback)', () => {
  const res = {
    setHeader: () => {},
    // no flushHeaders method
  }
  // Should not throw
  setSSEHeaders(res)
  assert.ok(true, 'No error thrown when flushHeaders is missing')
})

test('setSSEHeaders is idempotent — calling twice sets same headers', () => {
  const res = mockRes()
  setSSEHeaders(res)
  setSSEHeaders(res)

  assert.equal(res.getHeader('Content-Type'), 'text/event-stream; charset=utf-8')
  assert.equal(res.getHeader('Cache-Control'), 'no-cache, no-transform')
})

test('setSSEHeaders sends an initial SSE comment to defeat proxy buffering', () => {
  const res = mockRes()
  setSSEHeaders(res)
  assert.deepEqual(res.writes(), [': connected\n\n'])
})

test('startSSEHeartbeat writes keepalive comments and can be stopped', async () => {
  const res = mockRes()
  const stop = startSSEHeartbeat(res, () => true, 5)
  await new Promise((resolve) => setTimeout(resolve, 12))
  stop()

  const countAfterStop = res.writes().length
  await new Promise((resolve) => setTimeout(resolve, 8))

  assert.ok(countAfterStop >= 1)
  assert.equal(res.writes().every((line) => line === ': keepalive\n\n'), true)
  assert.equal(res.writes().length, countAfterStop)
})
