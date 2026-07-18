import { API_BASE } from './config.js'

export const getCsrfToken = () => {
  if (typeof document === 'undefined') return ''
  const found = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('arisehash_csrf='))
  return found ? decodeURIComponent(found.slice('arisehash_csrf='.length)) : ''
}

export const authHeaders = (method = 'GET') => {
  const headers = {}
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    const csrf = getCsrfToken()
    if (csrf) headers['X-CSRF-Token'] = csrf
  }
  return headers
}

async function req(path, { method = 'GET', body, form, auth = true, signal } = {}) {
  const headers = auth ? authHeaders(method) : {}
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, credentials: 'include', signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new Error('Tidak bisa terhubung ke server. Pastikan backend berjalan (npm run dev).')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (!data.error && [500, 502, 503, 504].includes(res.status)) {
      throw new Error('Server tidak merespons. Pastikan backend berjalan.')
    }
    throw new Error(data.error || 'Terjadi kesalahan pada server')
  }
  return data
}

export const api = {
  // Health / status
  health: () => req('/api/health', { auth: false }),

  // Authentication
  googleLogin: (credential) => req('/api/auth/google', { method: 'POST', body: { credential }, auth: false }),
  me: () => req('/api/auth/me'),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  logoutAll: () => req('/api/auth/logout-all', { method: 'POST' }),
  sessions: () => req('/api/auth/sessions'),
  revokeSession: (id) => req(`/api/auth/sessions/${id}`, { method: 'DELETE' }),
  updateProfile: (name) => req('/api/auth/me', { method: 'PATCH', body: { name } }),
  deleteAccount: () => req('/api/auth/me', { method: 'DELETE' }),

  // Blueprints (PRD Documents)
  blueprints: ({ page = 1, pageSize = 20, q = '', folder = '' } = {}) => {
    const params = new URLSearchParams({ page, pageSize })
    if (q) params.set('q', q)
    if (folder) params.set('folder', folder)
    return req(`/api/blueprints?${params}`)
  },
  blueprintFolders: () => req('/api/blueprints/folders'),
  duplicateBlueprint: (id, asTemplate = false) => req(`/api/blueprints/${id}/duplicate`, { method: 'POST', body: { asTemplate } }),
  getBlueprint: (id) => req(`/api/blueprints/${id}`),
  updateBlueprint: (id, content, name) => req(`/api/blueprints/${id}`, { method: 'PUT', body: { content, name } }),
  updateBlueprintMeta: (id, { folder, tags, name } = {}) => req(`/api/blueprints/${id}`, { method: 'PUT', body: { folder, tags, name } }),
  generateQuestions: (idea, template, model, aiKeyId, opts = {}) => req('/api/blueprints/generate-questions', { method: 'POST', body: { idea, template, model, aiKeyId }, signal: opts.signal }),
  restoreVersion: (id, versionNumber) => req(`/api/blueprints/${id}/restore`, { method: 'POST', body: { versionNumber } }),
  createVersionSnapshot: (id, name) => req(`/api/blueprints/${id}/version`, { method: 'POST', body: { name } }),
  toggleShare: (id, isPublic) => req(`/api/blueprints/${id}/share`, { method: 'POST', body: { isPublic } }),
  deleteBlueprint: (id) => req(`/api/blueprints/${id}`, { method: 'DELETE' }),
  getPublicShare: (token) => req(`/api/blueprints/share/${token}`, { auth: false }),

  // Code Projects (Sandpack IDE)
  codeProjects: ({ page = 1, pageSize = 20, q = '' } = {}) => {
    const params = new URLSearchParams({ page, pageSize })
    if (q) params.set('q', q)
    return req(`/api/code-projects?${params}`)
  },
  createCodeProject: (name, blueprintId, template, model, aiKeyId) => req('/api/code-projects', { method: 'POST', body: { name, blueprintId, template, model, aiKeyId } }),
  getCodeProject: (id) => req(`/api/code-projects/${id}`),
  saveCodeProject: (id, filesJson, messagesJson, name) => req(`/api/code-projects/${id}`, { method: 'PUT', body: { filesJson, messagesJson, name } }),
  deleteCodeProject: (id) => req(`/api/code-projects/${id}`, { method: 'DELETE' }),
  shareCodeProject: (id, isPublic, opts = {}) => req(`/api/code-projects/${id}/share`, { method: 'POST', body: { isPublic, ...opts } }),
  publicCodeProject: (token) => req(`/api/code-projects/share/${token}`),
  codeVersions: (id) => req(`/api/code-projects/${id}/versions`),
  codeVersion: (id, versionId) => req(`/api/code-projects/${id}/versions/${versionId}`),
  saveCodeVersion: (id, label) => req(`/api/code-projects/${id}/versions`, { method: 'POST', body: { label } }),
  restoreCodeVersion: (id, versionId) => req(`/api/code-projects/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  codeCollaborators: (id) => req(`/api/code-projects/${id}/collaborators`),
  addCodeCollaborator: (id, email, role) => req(`/api/code-projects/${id}/collaborators`, { method: 'POST', body: { email, role } }),
  removeCodeCollaborator: (id, userId) => req(`/api/code-projects/${id}/collaborators/${userId}`, { method: 'DELETE' }),

  // Custom AI models (BYOK)
  aiKeys: () => req('/api/ai-keys'),
  createAiKey: (data) => req('/api/ai-keys', { method: 'POST', body: data }),
  updateAiKey: (id, data) => req(`/api/ai-keys/${id}`, { method: 'PUT', body: data }),
  deleteAiKey: (id) => req(`/api/ai-keys/${id}`, { method: 'DELETE' }),
  testAiKey: (id) => req(`/api/ai-keys/${id}/test`, { method: 'POST' }),
  testAiConnection: (data) => req('/api/ai-keys/test-connection', { method: 'POST', body: data }),

  // Quotas & Plan Subscription
  quota: () => req('/api/quota'),
  usage: () => req('/api/quota/usage'),
  createPakasirCheckout: (planType) => req('/api/payment/pakasir/checkout', { method: 'POST', body: { planType } }),
  pakasirStatus: ({ orderId, amount }) => req(`/api/payment/pakasir/status?order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}`),
  changeToFreePlan: () => req('/api/payment/plan/free', { method: 'POST' }),
  cancelPaidPlan: () => req('/api/payment/plan/cancel', { method: 'POST' }),

  // Chat (Claude-like assistant)
  models: () => req('/api/models'),
  chats: ({ page = 1, pageSize = 20 } = {}) => {
    const params = new URLSearchParams({ page, pageSize })
    return req(`/api/chat?${params}`)
  },
  createChat: (model, aiKeyId) => req('/api/chat', { method: 'POST', body: { model, aiKeyId } }),
  getChat: (id) => req(`/api/chat/${id}`),
  renameChat: (id, title) => req(`/api/chat/${id}`, { method: 'PATCH', body: { title } }),
  setChatModel: (id, model, aiKeyId) => req(`/api/chat/${id}`, { method: 'PATCH', body: { model, aiKeyId } }),
  updateMessage: (chatId, messageId, content) => req(`/api/chat/${chatId}/messages/${messageId}`, { method: 'PATCH', body: { content } }),
  deleteChat: (id) => req(`/api/chat/${id}`, { method: 'DELETE' }),
  uploadFile: (chatId, file) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/api/chat/${chatId}/upload-file`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: { ...authHeaders('POST') }
    }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Gagal upload'); return d })
  },
  analyzeGithub: (chatId, url) => req(`/api/chat/${chatId}/analyze-github`, { method: 'POST', body: { url } }),

  // Admin Ops
  adminStats: () => req('/api/admin/stats'),
  adminObservability: () => req('/api/admin/observability'),
  adminUsers: ({ page = 1, pageSize = 10, q = '' } = {}) =>
    req(`/api/admin/users?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`),
  adminInvoices: ({ page = 1, pageSize = 10, q = '' } = {}) =>
    req(`/api/admin/invoices?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`),
  adminUpdateUserSubscription: (id, planType) => req(`/api/admin/users/${id}/subscription`, { method: 'POST', body: { planType } }),
  adminToggleRole: (id) => req(`/api/admin/users/${id}/role`, { method: 'POST' }),
  adminResetQuota: (id) => req(`/api/admin/users/${id}/reset-quota`, { method: 'POST' }),
  adminAuditLogs: (action = '', { page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams({ page, pageSize })
    if (action) params.set('action', action)
    return req(`/api/admin/audit-logs?${params}`)
  },
  adminAiLogs: (success = '', { page = 1, pageSize = 50 } = {}) => {
    const params = new URLSearchParams({ page, pageSize })
    if (success) params.set('success', success)
    return req(`/api/admin/ai-logs?${params}`)
  },
  adminAuditCsvUrl: () => `${API_BASE}/api/admin/audit-logs.csv`,
  adminAiCsvUrl: () => `${API_BASE}/api/admin/ai-logs.csv`,

  // Admin AI Keys
  adminAiKeys: () => req('/api/admin/ai-keys'),
  createAdminAiKey: (data) => req('/api/admin/ai-keys', { method: 'POST', body: data }),
  updateAdminAiKey: (id, data) => req(`/api/admin/ai-keys/${id}`, { method: 'PUT', body: data }),
  deleteAdminAiKey: (id) => req(`/api/admin/ai-keys/${id}`, { method: 'DELETE' }),
  testAdminAiKey: (id) => req(`/api/admin/ai-keys/${id}/test`, { method: 'POST' }),
  testAdminAiConnection: (data) => req('/api/admin/ai-keys/test-connection', { method: 'POST', body: data }),
  adminAiKeyUsage: (id) => req(`/api/admin/ai-keys/${id}/usage`)
}
