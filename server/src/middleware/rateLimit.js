import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const defaultKeyGenerator = (req) => req.user?.id || ipKeyGenerator(req.ip || req.socket?.remoteAddress || '')

export function createRateLimit({ windowMs = 60_000, maxRequests = 60, keyGenerator = defaultKeyGenerator }) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: 'Terlalu banyak permintaan dalam waktu singkat. Silakan coba lagi nanti.' })
    }
  })
}
