export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
  }
}

const isProd = () => process.env.NODE_ENV === 'production' || !!process.env.VERCEL

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500
  const prod = isProd()

  if (status >= 500) {
    console.error('[Error]', {
      method: req.method,
      path: req.originalUrl,
      status,
      message: err.message,
      stack: prod ? undefined : err.stack
    })
  }

  if (res.headersSent) return

  const message = status === 500 && prod
    ? 'Terjadi kesalahan internal server'
    : err.message

  res.status(status).json({ error: message })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' })
}
