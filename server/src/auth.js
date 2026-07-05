import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import crypto from 'node:crypto'
import { prisma } from './db.js'
import { logError } from './utils/logger.js'

import { IS_PROD } from './utils/config.js'

// Di produksi (Vercel/NODE_ENV=production) JWT_SECRET WAJIB diset — jangan
// diam-diam pakai 'dev-secret' yang publik (bisa dipakai memalsukan token admin).
if (IS_PROD && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diset di environment produksi.')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const SESSION_COOKIE = 'arisehash_session'
const CSRF_COOKIE = 'arisehash_csrf'
const SESSION_DAYS = 30
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

export const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || '').toLowerCase())

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        if (idx < 0) return [part, '']
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))]
      })
  )
}

const cookieBase = () => {
  const secure = IS_PROD
  return `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
}

function setCookie(res, name, value, attrs) {
  const existing = res.getHeader('Set-Cookie')
  const next = `${name}=${encodeURIComponent(value)}; ${attrs}`
  if (!existing) res.setHeader('Set-Cookie', next)
  else if (Array.isArray(existing)) res.setHeader('Set-Cookie', [...existing, next])
  else res.setHeader('Set-Cookie', [existing, next])
}

export function setAuthCookies(res, token, csrfToken) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60
  setCookie(res, SESSION_COOKIE, token, `HttpOnly; Max-Age=${maxAge}; ${cookieBase()}`)
  setCookie(res, CSRF_COOKIE, csrfToken, `Max-Age=${maxAge}; ${cookieBase()}`)
}

export function clearAuthCookies(res) {
  setCookie(res, SESSION_COOKIE, '', `HttpOnly; Max-Age=0; ${cookieBase()}`)
  setCookie(res, CSRF_COOKIE, '', `Max-Age=0; ${cookieBase()}`)
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export async function createSession(user, req = null) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: req?.headers?.['user-agent']?.slice(0, 500) || null,
      ipAddress: req?.ip || null
    }
  })
  return session
}

// Verifikasi credential (ID token) dari Google Identity Services.
export async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  })
  const p = ticket.getPayload()
  return { email: (p.email || '').toLowerCase(), name: p.name || p.email, picture: p.picture || null }
}

export const signToken = (user, session, csrfToken) =>
  jwt.sign({ uid: user.id, sid: session?.id, role: user.role, csrf: csrfToken }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` })

// Middleware: wajib login. Menaruh user lengkap di req.user.
export async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || '')
    const header = req.headers.authorization || ''
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null
    const token = bearerToken || cookies[SESSION_COOKIE] || null
    if (!token) return res.status(401).json({ error: 'Tidak ada token' })
    const payload = jwt.verify(token, JWT_SECRET)

    if (payload.sid) {
      // Bersihkan sesi basi secara periodik (~10% request) untuk hindari full-scan tiap saat
      if (Math.random() < 0.1) {
        prisma.authSession.deleteMany({
          where: { expiresAt: { lt: new Date() } }
        }).catch((err) => logError('Auth', 'Gagal membersihkan sesi basi', err))
      }

      const session = await prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.uid,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        }
      })
      if (!session) return res.status(401).json({ error: 'Sesi tidak valid atau sudah berakhir' })

      const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      if (!bearerToken && unsafe) {
        const csrfHeader = req.headers['x-csrf-token']
        if (!payload.csrf || csrfHeader !== payload.csrf || cookies[CSRF_COOKIE] !== payload.csrf) {
          return res.status(403).json({ error: 'Token CSRF tidak valid' })
        }
      }
      req.session = session
    }

    const user = await prisma.user.findUnique({ where: { id: payload.uid } })
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' })
    req.user = user
    next()
  } catch (err) {
    const isAuthError = err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError' || err?.name === 'NotBeforeError'
    if (isAuthError) {
      return res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa' })
    }
    console.error('[requireAuth] Server error:', err?.message)
    res.status(500).json({ error: 'Terjadi kesalahan internal server' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Khusus admin' })
  next()
}
