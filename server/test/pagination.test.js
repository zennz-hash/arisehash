import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePagination, paginatedResponse } from '../src/utils/pagination.js'

/* ── parsePagination ─────────────────────────────────────────────────── */

test('parsePagination uses defaults when no query params', () => {
  const result = parsePagination({})
  assert.equal(result.page, 1)
  assert.equal(result.pageSize, 20)
})

test('parsePagination uses custom defaultPageSize', () => {
  const result = parsePagination({}, 50)
  assert.equal(result.page, 1)
  assert.equal(result.pageSize, 50)
})

test('parsePagination parses page from query', () => {
  const result = parsePagination({ page: '3', pageSize: '10' })
  assert.equal(result.page, 3)
  assert.equal(result.pageSize, 10)
})

test('parsePagination clamps page to minimum 1', () => {
  assert.equal(parsePagination({ page: '0' }).page, 1)
  assert.equal(parsePagination({ page: '-5' }).page, 1)
})

test('parsePagination clamps pageSize between 1 and 50', () => {
  // pageSize '0' is falsy (parseInt('0') === 0), so falls through to default
  assert.equal(parsePagination({ pageSize: '0' }).pageSize, 20)
  // pageSize '-1' is truthy, clamped to minimum 1
  assert.equal(parsePagination({ pageSize: '-1' }).pageSize, 1)
  assert.equal(parsePagination({ pageSize: '51' }).pageSize, 50)
  assert.equal(parsePagination({ pageSize: '999' }).pageSize, 50)
})

test('parsePagination handles non-numeric query values gracefully', () => {
  const result = parsePagination({ page: 'abc', pageSize: 'xyz' })
  assert.equal(result.page, 1)
  assert.equal(result.pageSize, 20)
})

test('parsePagination handles partial query params', () => {
  assert.equal(parsePagination({ page: '2' }).page, 2)
  assert.equal(parsePagination({ page: '2' }).pageSize, 20)
  assert.equal(parsePagination({ pageSize: '15' }).page, 1)
  assert.equal(parsePagination({ pageSize: '15' }).pageSize, 15)
})

/* ── paginatedResponse ───────────────────────────────────────────────── */

test('paginatedResponse returns correct structure for first page', () => {
  const items = ['a', 'b', 'c']
  const result = paginatedResponse(items, 25, 1, 10)

  assert.deepEqual(result.items, items)
  assert.equal(result.total, 25)
  assert.equal(result.page, 1)
  assert.equal(result.pageSize, 10)
  assert.equal(result.totalPages, 3) // ceil(25/10) = 3
})

test('paginatedResponse ensures at least 1 totalPages', () => {
  const result = paginatedResponse([], 0, 1, 10)
  assert.equal(result.totalPages, 1) // not 0
  assert.equal(result.total, 0)
})

test('paginatedResponse exact division', () => {
  const result = paginatedResponse(Array(10), 20, 2, 10)
  assert.equal(result.totalPages, 2)
})

test('paginatedResponse rounding up totalPages', () => {
  assert.equal(paginatedResponse([], 1, 1, 10).totalPages, 1)
  assert.equal(paginatedResponse([], 11, 1, 10).totalPages, 2)
  assert.equal(paginatedResponse([], 21, 1, 10).totalPages, 3)
})

test('paginatedResponse preserves page and pageSize from parsePagination', () => {
  const query = { page: '3', pageSize: '10' }
  const { page, pageSize } = parsePagination(query)
  const result = paginatedResponse([], 100, page, pageSize)

  assert.equal(result.page, 3)
  assert.equal(result.pageSize, 10)
  assert.equal(result.totalPages, 10) // ceil(100/10) = 10
})
