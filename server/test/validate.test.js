import test from 'node:test'
import assert from 'node:assert/strict'
import { validate } from '../src/middleware/validate.js'
import { z } from 'zod'

function mockRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (data) => { res.body = data; return res }
  return res
}

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive().optional()
})

test('validate passes valid data through', (_, done) => {
  const req = { body: { name: 'John', age: 25 } }
  const res = mockRes()
  const middleware = validate(testSchema)

  middleware(req, res, () => {
    assert.equal(req.body.name, 'John')
    assert.equal(req.body.age, 25)
    assert.equal(res.statusCode, null)
    done()
  })
})

test('validate returns 400 for invalid data', () => {
  const req = { body: { name: '', age: -1 } }
  const res = mockRes()
  let nextCalled = false
  const middleware = validate(testSchema)

  middleware(req, res, () => { nextCalled = true })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Input tidak valid')
  assert.ok(res.body.details)
  assert.equal(nextCalled, false)
})

test('validate strips unknown fields', (_, done) => {
  const req = { body: { name: 'John', unknown: 'field', extra: 123 } }
  const res = mockRes()
  const middleware = validate(testSchema)

  middleware(req, res, () => {
    assert.equal(req.body.name, 'John')
    assert.equal(req.body.unknown, undefined)
    assert.equal(req.body.extra, undefined)
    done()
  })
})

test('validate returns field-level error details', () => {
  const req = { body: { age: 'not a number' } }
  const res = mockRes()
  const middleware = validate(testSchema)

  middleware(req, res, () => {})

  assert.equal(res.statusCode, 400)
  assert.ok(res.body.details.name)
})
