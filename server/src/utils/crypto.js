import crypto from 'crypto'
import { IS_PROD } from './config.js'

/**
 * Symmetric encryption for user-supplied API keys (AES-256-GCM).
 *
 * Priority for the key material (must differ from JWT_SECRET in production):
 *   1. AI_KEY_SECRET
 *   2. ENCRYPTION_KEY (legacy alias used in some env files)
 *   3. JWT_SECRET (dev fallback only — rejected in production)
 *
 * Stored format: <iv_hex>:<authTag_hex>:<cipher_hex>
 */
function resolveSecret() {
  const dedicated = process.env.AI_KEY_SECRET || process.env.ENCRYPTION_KEY
  if (dedicated) return dedicated
  if (IS_PROD) {
    throw new Error(
      'AI_KEY_SECRET (atau ENCRYPTION_KEY) wajib diset di produksi — jangan pakai JWT_SECRET untuk enkripsi API key.'
    )
  }
  if (process.env.JWT_SECRET) {
    console.warn(
      '[crypto] AI_KEY_SECRET tidak diset; fallback ke JWT_SECRET (hanya development). Set AI_KEY_SECRET terpisah.'
    )
    return process.env.JWT_SECRET
  }
  return 'arisehash-dev-fallback-secret-change-me'
}

const ACTIVE_SECRET = resolveSecret()
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
