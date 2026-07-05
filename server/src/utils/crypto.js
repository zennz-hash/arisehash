import crypto from 'crypto'
import { IS_PROD } from './config.js'

/**
 * Symmetric encryption for user-supplied API keys (AES-256-GCM).
 *
 * The key is derived from env AI_KEY_SECRET (any string) via scrypt so the
 * stored ciphertext is useless without the server secret. Format stored in DB:
 *   <iv_hex>:<authTag_hex>:<cipher_hex>
 */
const SECRET = process.env.AI_KEY_SECRET || process.env.JWT_SECRET
if (IS_PROD && !SECRET) {
  throw new Error('AI_KEY_SECRET atau JWT_SECRET wajib diset di environment produksi untuk melindungi enkripsi.')
}
const ACTIVE_SECRET = SECRET || 'arisehash-dev-fallback-secret-change-me'
const KEY = crypto.scryptSync(ACTIVE_SECRET, 'arisehash-aikey-salt', 32)

export function encryptSecret(plain) {
  if (plain == null) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptSecret(payload) {
  try {
    const [ivHex, tagHex, dataHex] = String(payload).split(':')
    if (!ivHex || !tagHex || !dataHex) return ''
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return ''
  }
}

// Mask a secret for safe display: show last 4 chars only.
export function maskSecret(plain) {
  const s = String(plain || '')
  if (s.length <= 4) return '••••'
  return '••••••••' + s.slice(-4)
}
