import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { timeAgo, uAgo, fmtDateTime, fmt, ACTIVITY_LABEL, USAGE_LABEL } from '../time.js'

describe('timeAgo / uAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "baru saja" for less than 60 seconds', () => {
    const now = new Date().toISOString()
    expect(timeAgo(now)).toBe('baru saja')
    expect(uAgo(now)).toBe('baru saja')
  })

  it('returns minutes ago for < 1 hour', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
    expect(timeAgo(d)).toBe('5 mnt lalu')
  })

  it('returns hours ago for < 24 hours', () => {
    const d = new Date(Date.now() - 3 * 3600 * 1000).toISOString() // 3 hours ago
    expect(timeAgo(d)).toBe('3 jam lalu')
  })

  it('returns days ago for >= 24 hours', () => {
    const d = new Date(Date.now() - 2 * 86400 * 1000).toISOString() // 2 days ago
    expect(timeAgo(d)).toBe('2 hari lalu')
  })

  it('returns 1 menit for exactly 60 seconds', () => {
    const d = new Date(Date.now() - 60 * 1000).toISOString()
    expect(timeAgo(d)).toBe('1 mnt lalu')
  })

  it('uAgo is an alias for timeAgo', () => {
    const d = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(uAgo(d)).toBe(timeAgo(d))
  })
})

describe('fmtDateTime / fmt', () => {
  it('formats a date in id-ID locale', () => {
    const result = fmtDateTime('2026-07-02T14:30:00Z')
    // Format varies by Node ICU: "2 Jul 14:30", "02 Jul, 21.30", etc.
    expect(result).toBeTruthy()
    expect(result).not.toBe('')
    expect(result).toMatch(/Jul|Juli/) // bulan July muncul
    expect(result).toMatch(/\d{2}[:.]\d{2}/) // jam:menit dengan : atau .
  })

  it('returns empty string for invalid date', () => {
    expect(fmtDateTime('not-a-date')).toBe('')
    expect(fmtDateTime(null)).toBe('')
    expect(fmtDateTime(undefined)).toBe('')
  })

  it('fmt is an alias for fmtDateTime', () => {
    expect(fmt('2026-07-02T14:30:00Z')).toBe(fmtDateTime('2026-07-02T14:30:00Z'))
    expect(fmt('invalid')).toBe('')
  })
})

describe('ACTIVITY_LABEL / USAGE_LABEL', () => {
  it('has all required activity labels', () => {
    expect(ACTIVITY_LABEL).toHaveProperty('CLAIM_QUOTA_PRD')
    expect(ACTIVITY_LABEL).toHaveProperty('CLAIM_QUOTA_CODE')
    expect(ACTIVITY_LABEL).toHaveProperty('REFUND_QUOTA_PRD')
    expect(ACTIVITY_LABEL).toHaveProperty('REFUND_QUOTA_CODE')
  })

  it('has descriptive Indonesian text', () => {
    expect(ACTIVITY_LABEL.CLAIM_QUOTA_PRD).toContain('PRD')
    expect(ACTIVITY_LABEL.CLAIM_QUOTA_CODE).toContain('kode')
    expect(ACTIVITY_LABEL.REFUND_QUOTA_PRD).toContain('kembalikan')
    expect(ACTIVITY_LABEL.REFUND_QUOTA_CODE).toContain('kembalikan')
  })

  it('USAGE_LABEL is an alias for ACTIVITY_LABEL (same reference)', () => {
    expect(USAGE_LABEL).toBe(ACTIVITY_LABEL)
    expect(USAGE_LABEL.CLAIM_QUOTA_PRD).toBe(ACTIVITY_LABEL.CLAIM_QUOTA_PRD)
  })
})
