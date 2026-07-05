import { Router } from 'express'
import { prisma } from '../db.js'
import {
  verifyGoogleCredential,
  signToken,
  isAdminEmail,
  requireAuth,
  createSession,
  createCsrfToken,
  setAuthCookies,
  clearAuthCookies
} from '../auth.js'
import { validate } from '../middleware/validate.js'
import { googleLoginSchema, updateProfileSchema } from '../schemas/auth.schema.js'
import { sendWelcomeEmail } from '../utils/email.js'
import { logError } from '../utils/logger.js'

const router = Router()

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role })

// POST /api/auth/google { credential } → verifikasi, upsert user, kembalikan token + user
router.post('/google', validate(googleLoginSchema), async (req, res, next) => {
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ error: 'credential wajib' })

    const profile = await verifyGoogleCredential(credential)
    if (!profile.email) return res.status(400).json({ error: 'Email Google tidak tersedia' })

    const existing = await prisma.user.findUnique({ where: { email: profile.email } })
    const role = existing?.role || (isAdminEmail(profile.email) ? 'ADMIN' : 'USER')
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name: profile.name, picture: profile.picture, role }
        })
      : await prisma.user.create({
          data: { email: profile.email, name: profile.name, picture: profile.picture, role }
        })

    if (!existing) sendWelcomeEmail(profile.email, profile.name).catch((err) => logError('Auth', 'Gagal kirim email welcome', err))

    const session = await createSession(user, req)
    const csrfToken = createCsrfToken()
    const token = signToken(user, session, csrfToken)
    setAuthCookies(res, token, csrfToken)
    res.json({ user: publicUser(user), csrfToken })
  } catch (e) {
    console.error('[Google Auth Error]', {
      message: e.message,
      code: e.code,
      responseErrors: e.response?.data?.error_description || e.response?.errors,
    })
    const msg = e.message || ''
    if (msg.includes('audience') || msg.includes('Token used too late') || msg.includes('wrong recipient')) {
      return res.status(401).json({ error: 'Credential Google tidak valid atau sudah kedaluwarsa. Pastikan Client ID di frontend dan backend sama, dan origin sudah terdaftar di Google Cloud Console.' })
    }
    if (msg.includes('network') || msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      return res.status(401).json({ error: 'Gagal menghubungi server Google. Periksa koneksi internet.' })
    }
    res.status(401).json({ error: 'Verifikasi Google gagal. Periksa log server untuk detail.' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

// GET /api/auth/sessions → list active sessions for the current user
router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const sessions = await prisma.authSession.findMany({
      where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, expiresAt: true, createdAt: true }
    })
    res.json(sessions.map((s) => ({ ...s, current: s.id === req.session?.id })))
  } catch (e) {
    next(e)
  }
})

// DELETE /api/auth/sessions/:id → revoke one session owned by current user
router.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.authSession.updateMany({
      where: { id: req.params.id, userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    })
    if (req.params.id === req.session?.id) clearAuthCookies(res)
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
})

// POST /api/auth/logout-all → revoke every active session for current user
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await prisma.authSession.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    })
    clearAuthCookies(res)
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
})

// POST /api/auth/logout → revoke current server-side session and clear cookies
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (req.session?.id) {
      await prisma.authSession.updateMany({
        where: { id: req.session.id, userId: req.user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    }
    clearAuthCookies(res)
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
})

// PATCH /api/auth/me { name } → update display name
router.patch('/me', requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { name } = req.body
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { name } })
    res.json({ user: publicUser(user) })
  } catch (e) {
    next(e)
  }
})

// DELETE /api/auth/me → permanently delete the account (cascades to all data)
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } })
    clearAuthCookies(res)
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
})

export default router
