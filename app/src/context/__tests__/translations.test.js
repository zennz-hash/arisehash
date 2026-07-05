import { describe, it, expect } from 'vitest'
import { T, LANGS, DEFAULT_LANG } from '../../i18n/translations.js'

describe('translations', () => {
  it('has LANGS with at least en and id', () => {
    const codes = LANGS.map(l => l.code)
    expect(codes).toContain('en')
    expect(codes).toContain('id')
  })

  it('DEFAULT_LANG is one of the supported locales', () => {
    const codes = LANGS.map(l => l.code)
    expect(codes).toContain(DEFAULT_LANG)
  })

  it('every translation key has both en and id values', () => {
    for (const [key, value] of Object.entries(T)) {
      expect(value, `key "${key}" missing "en"`).toHaveProperty('en')
      expect(value, `key "${key}" missing "id"`).toHaveProperty('id')
    }
  })

  it('no translation value is empty string', () => {
    for (const [key, value] of Object.entries(T)) {
      expect(value.en, `key "${key}" has empty "en"`).not.toBe('')
      expect(value.id, `key "${key}" has empty "id"`).not.toBe('')
    }
  })

  it('has navbar keys', () => {
    expect(T).toHaveProperty('nav.home')
    expect(T).toHaveProperty('nav.login')
  })
})
