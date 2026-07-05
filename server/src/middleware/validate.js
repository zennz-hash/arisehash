export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({
      error: 'Input tidak valid',
      details: result.error.flatten().fieldErrors
    })
  }
  req.body = result.data
  next()
}

export const ID_RE = /^[a-z0-9]{8,}$/i

/** Validates route params as valid IDs (UUID or CUID) before Prisma sees them. */
export const validateParams = (fields = ['id']) => (req, res, next) => {
  const errors = []
  for (const f of fields) {
    const v = req.params[f]
    if (v !== undefined && !ID_RE.test(v)) {
      errors.push(f)
    }
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: 'ID tidak valid', fields: errors })
  }
  next()
}
