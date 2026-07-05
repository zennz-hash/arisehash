/**
 * Shared time formatting utilities.
 * Centralized to avoid duplication across Dashboard, Settings, Admin, Chat, etc.
 */

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  return `${Math.floor(s / 86400)} hari lalu`
}

export { timeAgo as uAgo }
export { fmtDateTime as fmt }

export function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Compact relative time formatter for chat timestamps.
 * e.g. "baru saja", "5m lalu", "3j lalu", "2h lalu", "2 Jul"
 */
export function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}h lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// USAGE_LABEL is an alias for ACTIVITY_LABEL (both used across pages)
export { ACTIVITY_LABEL as USAGE_LABEL }

export const ACTIVITY_LABEL = {
  CLAIM_QUOTA_PRD: 'Membuat rencana proyek (PRD)',
  CLAIM_QUOTA_CODE: 'Menggunakan AI untuk kode',
  REFUND_QUOTA_PRD: 'Kuota PRD dikembalikan',
  REFUND_QUOTA_CODE: 'Kuota kode dikembalikan',
}
