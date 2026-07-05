// Entry serverless Vercel. Express app dipakai sebagai handler (app(req, res)).
// Lihat DEPLOY.md untuk langkah lengkap (ganti DATABASE_URL ke Postgres, dll).
import app from '../server/src/index.js'

export default app
