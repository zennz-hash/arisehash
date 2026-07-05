import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { generateCompletion, streamCompletion } from '../utils/ai.js'
import { claimQuota, refundQuota, tryClaimQuota } from '../utils/quota.js'
import { resolveUserAiKey } from './aiKeys.js'
import { createBlueprintVersion } from '../utils/versionControl.js'
import { validateBlueprintContent } from '../utils/outputValidation.js'
import crypto from 'node:crypto'
import { validate, validateParams } from '../middleware/validate.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { setSSEHeaders, MAX_AI_RESPONSE_LENGTH, safeSseError } from '../utils/stream.js'
import { parsePagination, paginatedResponse } from '../utils/pagination.js'
import { logError } from '../utils/logger.js'
import {
  generateQuestionsSchema,
  generateBlueprintSchema,
  updateBlueprintSchema,
  reviseBlueprintSchema,
  createVersionSchema,
  restoreVersionSchema,
  shareBlueprintSchema,
  duplicateBlueprintSchema
} from '../schemas/blueprint.schema.js'

const blueprintGenerateLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 5 })

const router = Router()

// GET /api/blueprints - List user blueprints (paginated)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query)
    const q = (req.query.q || '').trim()
    const folder = req.query.folder || undefined

    const where = { userId: req.user.id }
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }]
    if (folder) where.folder = folder

    const [total, list] = await Promise.all([
      prisma.blueprint.count({ where }),
      prisma.blueprint.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, type: true, isPublic: true, shareToken: true, folder: true, tagsJson: true, currentVersion: true, createdAt: true, updatedAt: true }
      })
    ])
    res.json(paginatedResponse(list, total, page, pageSize))
  } catch (err) {
    next(err)
  }
})

// GET /api/blueprints/folders - Distinct folders for the current user
router.get('/folders', requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.blueprint.findMany({
      where: { userId: req.user.id, folder: { not: null } },
      select: { folder: true },
      distinct: ['folder']
    })
    res.json(rows.map((r) => r.folder).filter(Boolean).sort())
  } catch (err) {
    next(err)
  }
})

// POST /api/blueprints/:id/duplicate - Clone a blueprint (optionally as template)
router.post('/:id/duplicate', requireAuth, validateParams(), validate(duplicateBlueprintSchema), async (req, res, next) => {
  try {
    const src = await prisma.blueprint.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!src) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })
    const suffix = req.body?.asTemplate ? '(Template)' : '(Salinan)'
    const copy = await prisma.blueprint.create({
      data: {
        userId: req.user.id,
        name: `${src.name} ${suffix}`,
        type: src.type,
        content: src.content,
        folder: src.folder,
        tagsJson: src.tagsJson,
        currentVersion: 1
      }
    })
    await createBlueprintVersion(copy.id, req.user.id, 'Duplikasi', src.content, 'GENERATE')
    res.json(copy)
  } catch (err) {
    next(err)
  }
})

// GET /api/blueprints/share/:token - Public blueprint fetch
router.get('/share/:token', async (req, res, next) => {
  try {
    const { token } = req.params
    const blueprint = await prisma.blueprint.findUnique({
      where: { shareToken: token }
    })

    if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan atau link kadaluwarsa' })
    if (blueprint.shareExpiresAt && new Date() > blueprint.shareExpiresAt) {
      return res.status(410).json({ error: 'Link publik sudah kadaluwarsa' })
    }

    // Increment shareViewCount
    const updated = await prisma.blueprint.update({
      where: { id: blueprint.id },
      data: { shareViewCount: { increment: 1 } }
    })

    res.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      content: updated.content,
      folder: updated.folder,
      tagsJson: updated.tagsJson,
      isPublic: updated.isPublic,
      shareToken: updated.shareToken,
      shareExpiresAt: updated.shareExpiresAt,
      shareViewCount: updated.shareViewCount,
      currentVersion: updated.currentVersion,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/blueprints/:id - Fetch single blueprint details & versions
router.get('/:id', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const blueprint = await prisma.blueprint.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        }
      }
    })
    if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })
    res.json(blueprint)
  } catch (err) {
    next(err)
  }
})

// POST /api/blueprints/generate-questions - Generate adaptive quiz questions
router.post('/generate-questions', requireAuth, validate(generateQuestionsSchema), async (req, res, next) => {
  try {
    const { idea, template, model: bodyModel, aiKeyId } = req.body
    const model = bodyModel || null

    const customCfg = await resolveUserAiKey(req.user.id, aiKeyId)

    const messages = [
      {
        role: 'system',
        content: `Anda adalah arsitek sistem software senior. Buatlah MAKSIMAL 5 pertanyaan kuis pilihan ganda (boleh kurang, 3-5) yang cerdas, kontekstual, dan SANGAT spesifik terhadap ide aplikasi pengguna.
Pertanyaan harus relevan dengan domain ide (mis. untuk e-commerce tanyakan metode pembayaran; untuk LMS tanyakan jenis konten; untuk fintech tanyakan kepatuhan/keamanan).
Setiap pertanyaan punya 3-4 opsi jawaban singkat & jelas.
Tanggapi HANYA dengan JSON mentah tanpa markdown (tanpa blok \`\`\`json) berupa array objek:
[
  { "id": 1, "question": "Teks pertanyaan...", "options": ["Opsi A", "Opsi B", "Opsi C"] }
]`
      },
      {
        role: 'user',
        content: `Ide aplikasi: ${idea}\nKategori template: ${template}`
      }
    ]

    const responseText = await generateCompletion(messages, { response_format: { type: 'json_object' } }, req.user.id, model, customCfg)
    let questions
    try {
      const parsed = JSON.parse(responseText)
      // OpenAI JSON mode requires a root key sometimes, or we look for the list
      questions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || Object.values(parsed)[0])
    } catch {
      // Fallback questions if JSON parsing fails
      questions = [
        { id: 1, question: "Berapa kapasitas skala pengguna yang direncanakan?", options: ["Kecil (SaaS MVP)", "Sedang (Hingga 50rb user)", "Besar (Enterprise/Skala Luas)"] },
        { id: 2, question: "Metode otentikasi mana yang Anda sukai?", options: ["Email & Password biasa", "Google OAuth / Social Login", "Web3 Wallet (Metamask/Rainbow)"] },
        { id: 3, question: "Penyimpanan data yang Anda butuhkan?", options: ["Relational Database (PostgreSQL/SQLite)", "NoSQL Database (MongoDB/Redis)", "Hybrid / Blockchain"] }
      ]
    }

    // Cap at max 5, normalize ids, ensure options exist.
    if (!Array.isArray(questions)) questions = []
    questions = questions
      .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length)
      .slice(0, 5)
      .map((q, i) => ({ id: i + 1, question: String(q.question), options: q.options.map(String).slice(0, 4) }))

    res.json(questions)
  } catch (err) {
    next(err)
  }
})

// POST /api/blueprints/generate - Stream blueprint PRD generation via SSE
router.post('/generate', requireAuth, blueprintGenerateLimiter, validate(generateBlueprintSchema), async (req, res, next) => {
  const { idea, template, quizAnswers, name, model: bodyModel, frontend, backend, database, deploy, techMode, aiKeyId } = req.body
  const model = bodyModel || null
  const isAuto = techMode === 'auto'

  const customCfg = await resolveUserAiKey(req.user.id, aiKeyId)

  // Enforce quota BEFORE any work (built-in models only; BYOK bypasses quota).
  const { quotaClaimed } = await tryClaimQuota(req, res, 'prd', 1, customCfg)
  if (!quotaClaimed) return

  // Set response headers for Server-Sent Events (SSE)
  setSSEHeaders(res)

  const messages = [
    {
      role: 'system',
      content: `Anda adalah arsitek sistem AI dan pakar rekayasa perangkat lunak senior.
Tugas Anda adalah membuat Dokumen Spesifikasi Produk (PRD) yang mendalam dan lengkap untuk ide aplikasi pengguna.
Dokumen harus ditulis dalam Bahasa Indonesia secara profesional dan detail.

PRD harus menggunakan format Markdown dan mencakup sub-bagian berikut:
1. # Ringkasan Eksekutif (Executive Summary)
   - Deskripsi ide dan variabel masalah & solusi.
2. # Arsitektur Teknologi & Sistem
   - Stack teknologi yang diusulkan dan alasannya.
   - Flowchart diagram sistem menggunakan diagram Mermaid.js:
     \`\`\`mermaid
     flowchart TD
       ...
     \`\`\`
3. # Skema Database Detail
   - Menggunakan kode schema Prisma ORM yang fungsional.
4. # Rencana Instruksi Coding (Vibecoding Plan)
   - Rencana modular langkah-demi-langkah dalam membangun komponen web.

Pastikan kode Mermaid.js terbungkus dengan rapi di dalam blok markdown \`\`\`mermaid.`
    },
    {
      role: 'user',
      content: isAuto
        ? `Ide aplikasi: ${idea}
Kategori template: ${template}
Mode stack: OTOMATIS — Anda sebagai AI bebas memilih dan merekomendasikan tech stack (frontend, backend, database, deployment) TERBAIK untuk ide ini, sertakan alasan singkat pemilihannya.
Jawaban Kuis Tambahan: ${JSON.stringify(quizAnswers || [])}`
        : `Ide aplikasi: ${idea}
Kategori template: ${template}
Mode stack: MANUAL — gunakan pilihan pengguna berikut (jika ada yang kosong, rekomendasikan yang terbaik):
- Frontend: ${frontend || 'Bebas'}
- Backend: ${backend || 'Bebas'}
- Database: ${database || 'Bebas'}
- Deployment: ${deploy || 'Bebas'}
Jawaban Kuis Tambahan: ${JSON.stringify(quizAnswers || [])}`
    }
  ]

  // Detect client disconnect — stop writing to prevent resource leak.
  let clientConnected = true
  req.on('close', () => { clientConnected = false })
  const safeWrite = (data) => {
    if (!clientConnected || res.destroyed) return false
    try { res.write(data); return true } catch { return false }
  }

  let accumulatedContent = ''
  try {
    // Forward each token to the client as an SSE event while accumulating it.
    await streamCompletion(messages, (token) => {
      if (!clientConnected) throw new Error('Koneksi terputus oleh pengguna')
      accumulatedContent += token
      if (accumulatedContent.length > MAX_AI_RESPONSE_LENGTH) {
        throw new Error('Respons AI melebihi batas maksimum (500.000 karakter)')
      }
      safeWrite(`data: ${JSON.stringify({ token })}\n\n`)
    }, req.user.id, model, customCfg)

    if (!clientConnected) {
      if (quotaClaimed) await refundQuota(req.user.id, 'prd')
      if (!res.destroyed) res.end()
      return
    }

    // Save final blueprint in database
    const blueprintName = name || `Blueprint - ${idea.slice(0, 30)}...`
    const newBlueprint = await prisma.blueprint.create({
      data: {
        userId: req.user.id,
        name: blueprintName,
        type: template,
        content: accumulatedContent,
        currentVersion: 1
      }
    })

    // Create initial version snapshot
    await createBlueprintVersion(newBlueprint.id, req.user.id, 'Inisiasi Awal AI', accumulatedContent, 'GENERATE')

    // Write final meta event containing the document id
    safeWrite(`data: ${JSON.stringify({ blueprintId: newBlueprint.id, done: true, validationWarnings: validateBlueprintContent(accumulatedContent) })}\n\n`)
    if (!res.destroyed) res.end()
  } catch (err) {
    logError('Generate PRD', 'Streaming failed', err)
    // Refund quota on failure (only if it was actually claimed)
    if (quotaClaimed) await refundQuota(req.user.id, 'prd')
    safeWrite(`data: ${JSON.stringify({ error: safeSseError(err) })}\n\n`)
    if (!res.destroyed) res.end()
  }
})

// PUT /api/blueprints/:id - Update blueprint content manually
router.put('/:id', requireAuth, validateParams(), validate(updateBlueprintSchema), async (req, res, next) => {
  try {
    const { content, name, folder, tags } = req.body
    const { id } = req.params

    const blueprint = await prisma.blueprint.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const data = {
      name: name ?? blueprint.name,
      content: content ?? blueprint.content
    }
    // Metadata (optional)
    if (folder !== undefined) data.folder = folder || null
    if (tags !== undefined) data.tagsJson = JSON.stringify(Array.isArray(tags) ? tags : [])

    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.blueprint.updateMany({
      where: { id, userId: req.user.id },
      data
    })
    if (updateResult.count === 0) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const updatedBlueprint = await prisma.blueprint.findUnique({ where: { id } })

    // Only snapshot when the document content actually changed.
    if (content !== undefined && content !== blueprint.content) {
      await createBlueprintVersion(id, req.user.id, 'Perubahan Manual', content, 'MANUAL_EDIT')
    }

    res.json(updatedBlueprint)
  } catch (err) {
    next(err)
  }
})

// POST /api/blueprints/:id/revise - AI revises the document from a prompt (SSE)
router.post('/:id/revise', requireAuth, validateParams(), validate(reviseBlueprintSchema), async (req, res, next) => {
  const { id } = req.params
  const { instruction, mode: bodyMode, model: bodyModel, aiKeyId } = req.body || {}
  if (!instruction || !instruction.trim()) {
    return res.status(400).json({ error: 'Instruksi revisi wajib diisi' })
  }
  const mode = bodyMode === 'max' ? 'max' : 'standard'

  const blueprint = await prisma.blueprint.findFirst({ where: { id, userId: req.user.id } })
  if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

  const customCfg = await resolveUserAiKey(req.user.id, aiKeyId)
  const model = bodyModel || null

  // Enforce quota BEFORE any work (built-in models only; BYOK bypasses quota).
  const { quotaClaimed } = await tryClaimQuota(req, res, 'prd', 1, customCfg)
  if (!quotaClaimed) return

  setSSEHeaders(res)

  // Context pruning: send outline (headers) + nearest 6000 chars + instruction.
  const outline = blueprint.content
    .split('\n')
    .filter((l) => /^(#{1,4}\s|[-*]\s)/.test(l.trim()))
    .join('\n')
    .slice(0, 2000)

  const messages = [
    {
      role: 'system',
      content: `Anda adalah arsitek sistem AI. Tugas Anda merevisi Dokumen PRD (Markdown) yang sudah ada sesuai instruksi pengguna.
Kembalikan DOKUMEN PRD LENGKAP versi terbaru dalam format Markdown (bukan hanya bagian yang diubah).
Pertahankan struktur, bagian Mermaid (\`\`\`mermaid), dan skema yang masih relevan. Tulis dalam Bahasa Indonesia.`
    },
    {
      role: 'user',
      content: `Kerangka PRD saat ini:\n${outline}\n\n--- ISI PRD SAAT INI ---\n${blueprint.content.slice(0, 6000)}\n\n--- INSTRUKSI REVISI ---\n${instruction.trim()}`
    }
  ]

  // Detect client disconnect
  let clientConnected = true
  req.on('close', () => { clientConnected = false })
  const safeWrite = (data) => {
    if (!clientConnected || res.destroyed) return false
    try { res.write(data); return true } catch { return false }
  }

  let accumulated = ''
  try {
    await streamCompletion(messages, (token) => {
      if (!clientConnected) throw new Error('Koneksi terputus oleh pengguna')
      accumulated += token
      if (accumulated.length > MAX_AI_RESPONSE_LENGTH) {
        throw new Error('Respons AI melebihi batas maksimum (500.000 karakter)')
      }
      safeWrite(`data: ${JSON.stringify({ token })}\n\n`)
    }, req.user.id, model, customCfg)

    if (!clientConnected) {
      if (quotaClaimed) await refundQuota(req.user.id, 'prd')
      if (!res.destroyed) res.end()
      return
    }

    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.blueprint.updateMany({
      where: { id, userId: req.user.id },
      data: { content: accumulated }
    })
    if (updateResult.count === 0) {
      safeWrite(`data: ${JSON.stringify({ error: 'Blueprint tidak ditemukan' })}\n\n`)
      if (!res.destroyed) res.end()
      return
    }

    const updated = await prisma.blueprint.findUnique({ where: { id } })
    await createBlueprintVersion(id, req.user.id, 'Revisi AI', accumulated, 'AI_REVISE')

    safeWrite(`data: ${JSON.stringify({ done: true, currentVersion: updated.currentVersion, validationWarnings: validateBlueprintContent(accumulated) })}\n\n`)
    if (!res.destroyed) res.end()
  } catch (err) {
    logError('Blueprint Revise', 'failed', err)
    if (quotaClaimed) await refundQuota(req.user.id, 'prd')
    safeWrite(`data: ${JSON.stringify({ error: safeSseError(err) })}\n\n`)
    if (!res.destroyed) res.end()
  }
})

// POST /api/blueprints/:id/version - Create named snapshot manual
router.post('/:id/version', requireAuth, validateParams(), validate(createVersionSchema), async (req, res, next) => {
  try {
    const { name } = req.body
    const { id } = req.params

    const blueprint = await prisma.blueprint.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const newVer = await createBlueprintVersion(id, req.user.id, name || `Revisi Versi ${blueprint.currentVersion + 1}`, blueprint.content, 'MANUAL')
    res.json(newVer)
  } catch (err) {
    next(err)
  }
})

// POST /api/blueprints/:id/restore - Restore to specific version
router.post('/:id/restore', requireAuth, validateParams(), validate(restoreVersionSchema), async (req, res, next) => {
  try {
    const { versionNumber } = req.body
    const { id } = req.params
    const version = parseInt(versionNumber)
    if (!Number.isInteger(version)) return res.status(400).json({ error: 'Nomor versi tidak valid' })

    const blueprint = await prisma.blueprint.findFirst({ where: { id, userId: req.user.id } })
    if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const snapshot = await prisma.blueprintVersion.findFirst({
      where: { blueprintId: id, version }
    })
    if (!snapshot) return res.status(404).json({ error: 'Snapshot versi tidak ditemukan' })

    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.blueprint.updateMany({
      where: { id, userId: req.user.id },
      data: { content: snapshot.content }
    })
    if (updateResult.count === 0) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const restored = await prisma.blueprint.findUnique({ where: { id } })
    await createBlueprintVersion(id, req.user.id, `Restore dari Versi ${versionNumber}`, snapshot.content, 'RESTORE')

    res.json(restored)
  } catch (err) {
    next(err)
  }
})

// POST /api/blueprints/:id/share - Toggle share status
router.post('/:id/share', requireAuth, validateParams(), validate(shareBlueprintSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { isPublic } = req.body

    const blueprint = await prisma.blueprint.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!blueprint) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const shareToken = isPublic ? crypto.randomBytes(16).toString('hex') : null
    const shareExpiresAt = isPublic ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // 30 days

    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.blueprint.updateMany({
      where: { id, userId: req.user.id },
      data: { isPublic, shareToken, shareExpiresAt }
    })
    if (updateResult.count === 0) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    const updated = await prisma.blueprint.findUnique({ where: { id } })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/blueprints/:id - Delete blueprint
router.delete('/:id', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const { id } = req.params
    // Atomic delete with ownership check (prevents TOCTOU race)
    const deleteResult = await prisma.blueprint.deleteMany({
      where: { id, userId: req.user.id }
    })
    if (deleteResult.count === 0) return res.status(404).json({ error: 'Blueprint tidak ditemukan' })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
