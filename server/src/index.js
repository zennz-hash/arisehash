import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import * as Sentry from '@sentry/node'

import './sentry.js'

import authRoutes from './routes/auth.js'
import blueprintRoutes from './routes/blueprints.js'
import codeProjectRoutes from './routes/codeProjects.js'
import chatRoutes from './routes/chat.js'
import quotaRoutes from './routes/quota.js'
import adminRoutes from './routes/admin.js'
import aiKeyRoutes from './routes/aiKeys.js'
import { requireAuth } from './auth.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { resolveModels } from './utils/ai.js'

const app = express()
app.set('trust proxy', 1)

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('Origin tidak diizinkan oleh CORS'))
  },
  credentials: true
}))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
})
app.use(express.json({ limit: '15mb' }))

// Rate limiting
const apiLimiter = rateLimit({ 
  windowMs: 60_000, 
  max: 120, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { error: 'Terlalu banyak permintaan, coba lagi sebentar.' } 
})
const authLimiter = rateLimit({ 
  windowMs: 60_000, 
  max: 30, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { error: 'Terlalu banyak percobaan login, tunggu sebentar.' } 
})
// Dedicated, stricter limiter for expensive AI endpoints (generate/revise/stream).
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan AI. Mohon tunggu sebentar sebelum mencoba lagi.' }
})

app.use('/api', apiLimiter)

app.get('/api/health', (req, res) => res.json({
  ok: true,
  ts: Date.now(),
  service: 'arisehash-api',
  ai: {
    standardConfigured: Boolean(process.env.AI_STANDARD_KEY),
    maxConfigured: Boolean(process.env.AI_MAX_KEY)
  },
  database: Boolean(process.env.DATABASE_URL)
}))

// Throttle the heavy AI generation/streaming paths specifically.
app.use('/api/blueprints/generate', aiLimiter)
app.use('/api/blueprints/generate-questions', aiLimiter)
app.use(/^\/api\/blueprints\/[^/]+\/revise$/, aiLimiter)
app.use(/^\/api\/code-projects\/[^/]+\/stream$/, aiLimiter)
app.use(/^\/api\/chat\/[^/]+\/message$/, aiLimiter)

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/blueprints', blueprintRoutes)
app.use('/api/code-projects', codeProjectRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/quota', quotaRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai-keys', aiKeyRoutes)

// GET /api/models - standalone endpoint for active AI models (used by dropdowns)
app.get('/api/models', requireAuth, async (req, res, next) => {
  try {
    const models = await resolveModels()
    const unique = []
    const seen = new Set()
    for (const m of models) {
      if (!seen.has(m.model)) {
        seen.add(m.model)
        unique.push(m)
      }
    }
    res.json(unique.map((m) => ({ id: m.id, label: m.label, model: m.model })))
  } catch (err) {
    next(err)
  }
})

app.use(notFoundHandler)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}
app.use(errorHandler)

const PORT = process.env.PORT || 4000
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`AriseHash API berjalan di http://localhost:${PORT}`))
}

export default app
