import net from 'node:net'
import { lookup } from 'node:dns/promises'

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal', 'metadata'])

/** Extra host suffixes that must never be used as AI base URLs. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.corp', '.home', '.lan']

export function isPrivateIPv4(host) {
  const parts = host.split('.').map((x) => Number(x))
  if (parts.length !== 4 || parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return false
  const [a, b] = parts
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 127
    || a === 0
    || (a === 169 && b === 254) // link-local / cloud metadata
    || (a === 100 && b >= 64 && b <= 127) // CGNAT / some cloud internal
}

export function isPrivateIPv6(host) {
  const h = String(host).toLowerCase()
  // Loopback, unique-local (fc00::/7 → fc/fd), link-local (fe80::/10)
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true
  // IPv4-mapped (::ffff:a.b.c.d) — unwrap and reuse the IPv4 check
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

/**
 * Verifies that the hostname does not resolve to a private IP address.
 * This mitigates DNS rebinding attacks. Checks BOTH IPv4 and IPv6 results —
 * an IPv6-only host pointing at a private address must not slip through.
 * DNS failures are treated as unsafe in production (fail closed).
 */
export async function validateResolvedIp(hostname, { isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL } = {}) {
  if (net.isIP(hostname)) {
    const v = net.isIP(hostname)
    if (v === 4 && isPrivateIPv4(hostname)) throw new Error('Base URL tidak boleh memakai IP private.')
    if (v === 6 && isPrivateIPv6(hostname)) throw new Error('Base URL tidak boleh memakai IP private.')
    return
  }
  try {
    const addresses = await lookup(hostname, { all: true })
    if (!addresses.length) {
      if (isProd) throw new Error('Base URL tidak dapat di-resolve (DNS kosong).')
      return
    }
    for (const { address, family } of addresses) {
      const isPrivate = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address)
      if (isPrivate) {
        throw new Error('Base URL menghasilkan IP private setelah DNS resolution.')
      }
    }
  } catch (err) {
    if (err.message.includes('IP private') || err.message.includes('DNS kosong') || err.message.includes('tidak boleh')) throw err
    if (isProd) throw new Error('Base URL tidak dapat di-resolve. Periksa hostname model.')
    // Dev: DNS resolution failure is acceptable for some internal hosts
  }
}

export function normalizeAiBaseUrl(raw, { isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL } = {}) {
  let parsed
  try {
    parsed = new URL(String(raw || '').trim())
  } catch {
    throw new Error('Base URL tidak valid.')
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Base URL harus memakai http atau https.')
  }
  if (isProd && parsed.protocol !== 'https:') {
    throw new Error('Base URL model kustom wajib memakai HTTPS di produksi.')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    throw new Error('Base URL tidak boleh mengarah ke host lokal/private.')
  }
  // Block numeric-looking weird hosts and bare IPs that are private
  const ipVersion = net.isIP(hostname)
  if (ipVersion === 4 && isPrivateIPv4(hostname)) {
    throw new Error('Base URL tidak boleh memakai IP private.')
  }
  if (ipVersion === 6 && isPrivateIPv6(hostname)) {
    throw new Error('Base URL tidak boleh memakai IP private.')
  }

  // Reject userinfo in URL (credential smuggling / SSRF tricks)
  if (parsed.username || parsed.password) {
    throw new Error('Base URL tidak boleh mengandung username/password.')
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}
