import test from 'node:test'
import assert from 'node:assert/strict'
import { AppError, errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js'

function mockRes() {
  const res = { statusCode: null, body: null, headersSent: false }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (data) => { res.body = data; return res }
  return res
}

test('AppError sets message and statusCode', () => {
  const err = new AppError('Test error', 422)
  assert.equal(err.message, 'Test error')
  assert.equal(err.statusCode, 422)
  assert.ok(err instanceof Error)
})

test('AppError defaults to 500', () => {
  const err = new AppError('Oops')
  assert.equal(err.statusCode, 500)
})

test('errorHandler returns error message for 4xx errors', () => {
  const res = mockRes()
  const err = new AppError('Not found', 404)
  errorHandler(err, {}, res, () => {})
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Not found')
})

test('errorHandler returns error message for 500 in non-production', () => {
  const originalEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'test'
  process.env.VERCEL = ''

  const res = mockRes()
  const err = new Error('Database connection failed')
  errorHandler(err, {}, res, () => {})

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'Database connection failed')

  process.env.NODE_ENV = originalEnv
})

test('errorHandler hides internal error in production', () => {
  const originalEnv = process.env.NODE_ENV
  const originalVercel = process.env.VERCEL
  process.env.NODE_ENV = 'production'
  process.env.VERCEL = '1'

  const res = mockRes()
  const err = new Error('Some internal detail')
  errorHandler(err, {}, res, () => {})

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'Terjadi kesalahan internal server')

  process.env.NODE_ENV = originalEnv
  process.env.VERCEL = originalVercel
})

test('errorHandler uses AppError statusCode', () => {
  const res = mockRes()
  const err = new AppError('Forbidden', 403)
  errorHandler(err, {}, res, () => {})
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Forbidden')
})

test('errorHandler does nothing if headers already sent', () => {
  const res = mockRes()
  res.headersSent = true
  const err = new Error('test')
  errorHandler(err, {}, res, () => {})
  assert.equal(res.statusCode, null)
})

test('notFoundHandler returns 404', () => {
  const res = mockRes()
  notFoundHandler({}, res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Not found')
})
