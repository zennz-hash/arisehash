/**
 * Shared pagination utilities.
 * Centralizes pagination logic used across route files.
 */

/**
 * Parses pagination query parameters with safe defaults.
 * @param {import('express').Request['query']} query
 * @param {number} [defaultPageSize=20]
 * @returns {{ page: number, pageSize: number }}
 */
export function parsePagination(query, defaultPageSize = 20) {
  const page = Math.max(1, parseInt(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize) || defaultPageSize))
  return { page, pageSize }
}

/**
 * Builds a paginated JSON response object.
 * @param {Array} items - The items for the current page
 * @param {number} total - Total number of items across all pages
 * @param {number} page - Current page number
 * @param {number} pageSize - Items per page
 * @returns {{ items: Array, total: number, page: number, pageSize: number, totalPages: number }}
 */
export function paginatedResponse(items, total, page, pageSize) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}
