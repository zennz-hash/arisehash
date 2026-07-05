import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { claimQuota, refundQuota, calculateCreditCost, tryClaimQuota } from '../utils/quota.js'
import { streamCompletion } from '../utils/ai.js'
import { defaultFilesFor, promptHintFor, isValidTemplate } from '../utils/stacks.js'
import { resolveUserAiKey } from './aiKeys.js'
import { validateGeneratedFiles } from '../utils/outputValidation.js'
import { validate, validateParams } from '../middleware/validate.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { setSSEHeaders, MAX_AI_RESPONSE_LENGTH } from '../utils/stream.js'
import { parsePagination, paginatedResponse } from '../utils/pagination.js'
import { logError } from '../utils/logger.js'
import {
  createCodeProjectSchema,
  updateCodeProjectSchema,
  shareCodeProjectSchema,
  addCollaboratorSchema,
  streamCodeProjectSchema,
  saveVersionSchema
} from '../schemas/codeProject.schema.js'
import { sendCollaboratorInvite } from '../utils/email.js'

const router = Router()
const codeStreamLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 5 })

async function findAccessibleProject(id, userId, { edit = false } = {}) {
  return prisma.codeProject.findFirst({
    where: {
      id,
      OR: [
        { userId },
        {
          collaborators: {
            some: {
              userId,
              role: edit ? 'EDITOR' : { in: ['VIEWER', 'EDITOR'] }
            }
          }
        }
      ]
    },
    include: {
      collaborators: {
        include: { user: { select: { id: true, email: true, name: true, picture: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  })
}

// GET /api/code-projects - Get list of user's code projects (paginated)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query)
    const q = (req.query.q || '').trim()

    const where = {
      OR: [
        { userId: req.user.id },
        { collaborators: { some: { userId: req.user.id } } }
      ]
    }
    if (q) where.name = { contains: q, mode: 'insensitive' }

    const [total, list] = await Promise.all([
      prisma.codeProject.count({ where }),
      prisma.codeProject.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, template: true, isPublic: true, shareToken: true, shareViewCount: true, shareAllowDownload: true, createdAt: true, updatedAt: true }
      })
    ])
    res.json(paginatedResponse(list, total, page, pageSize))
  } catch (err) {
    next(err)
  }
})

// POST /api/code-projects - Create/Initialize new code project
router.post('/', requireAuth, validate(createCodeProjectSchema), async (req, res, next) => {
  try {
    const { name, blueprintId, model } = req.body
    const template = isValidTemplate(req.body.template) ? req.body.template : 'react'

    let initialFiles = defaultFilesFor(template)

    // Optional: seed the entry file with a note referencing the blueprint.
    if (blueprintId) {
      const bp = await prisma.blueprint.findFirst({
        where: { id: blueprintId, userId: req.user.id }
      })
      if (bp && initialFiles['/App.js']) {
        initialFiles['/App.js'] = `import './styles.css';

// ${bp.name} — ${bp.type}
export default function App() {
  return (
    <div className="app">
      <h1>${bp.name}</h1>
      <p>Spesifikasi (PRD) sudah terhubung. Ketik instruksi di kiri untuk menghasilkan kodenya.</p>
    </div>
  );
}`
      }
    }

    const project = await prisma.codeProject.create({
      data: {
        userId: req.user.id,
        name: name || `Proyek Koding - ${new Date().toLocaleDateString('id-ID')}`,
        template,
        mode: model || 'standard',
        filesJson: JSON.stringify(initialFiles),
        messagesJson: JSON.stringify([])
      }
    })

    res.json(project)
  } catch (err) {
    next(err)
  }
})

// GET /api/code-projects/:id - Load code project
// GET /api/code-projects/share/:token - Public read-only fetch (no auth)
router.get('/share/:token', async (req, res, next) => {
  try {
    const project = await prisma.codeProject.findUnique({ where: { shareToken: req.params.token } })
    if (!project || !project.isPublic) return res.status(404).json({ error: 'Proyek tidak ditemukan atau link nonaktif' })
    if (project.shareExpiresAt && new Date() > project.shareExpiresAt) {
      return res.status(410).json({ error: 'Link publik sudah kadaluwarsa' })
    }
    const updated = await prisma.codeProject.update({
      where: { id: project.id },
      data: { shareViewCount: { increment: 1 } }
    })
    res.json({
      id: updated.id,
      name: updated.name,
      template: updated.template,
      filesJson: updated.filesJson,
      isPublic: updated.isPublic,
      shareAllowDownload: updated.shareAllowDownload,
      shareViewCount: updated.shareViewCount,
      shareExpiresAt: updated.shareExpiresAt
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    res.json(project)
  } catch (err) {
    next(err)
  }
})

// PUT /api/code-projects/:id - Save code project
router.put('/:id', requireAuth, validateParams(), validate(updateCodeProjectSchema), async (req, res, next) => {
  try {
    const { filesJson, messagesJson, name } = req.body
    const { id } = req.params

    const project = await findAccessibleProject(id, req.user.id, { edit: true })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })

    const updated = await prisma.codeProject.update({
      where: { id },        data: {
          name: name || project.name,
          mode: req.body.model || project.mode,
          filesJson: filesJson || project.filesJson,
          messagesJson: messagesJson || project.messagesJson
        }
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/code-projects/:id - Delete a code project (and its versions)
router.delete('/:id', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const { id } = req.params
    // Atomic delete with ownership check (prevents TOCTOU race)
    await prisma.codeProjectVersion.deleteMany({ where: { codeProjectId: id, codeProject: { userId: req.user.id } } })
    const deleteResult = await prisma.codeProject.deleteMany({ where: { id, userId: req.user.id } })
    if (deleteResult.count === 0) return res.status(404).json({ error: 'Project tidak ditemukan' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/code-projects/:id/share - Toggle public sharing
router.post('/:id/share', requireAuth, validateParams(), validate(shareCodeProjectSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { isPublic, expiresInDays = 30, allowDownload = false } = req.body
    const project = await prisma.codeProject.findFirst({ where: { id, userId: req.user.id } })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    const shareToken = isPublic ? (project.shareToken || crypto.randomBytes(16).toString('hex')) : null
    const days = Math.min(365, Math.max(1, parseInt(expiresInDays) || 30))
    const shareExpiresAt = isPublic ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null

    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.codeProject.updateMany({
      where: { id, userId: req.user.id },
      data: { isPublic: !!isPublic, shareToken, shareExpiresAt, shareAllowDownload: !!allowDownload }
    })
    if (updateResult.count === 0) return res.status(404).json({ error: 'Project tidak ditemukan' })

    const updated = await prisma.codeProject.findUnique({ where: { id } })
    res.json({
      id: updated.id,
      isPublic: updated.isPublic,
      shareToken: updated.shareToken,
      shareExpiresAt: updated.shareExpiresAt,
      shareAllowDownload: updated.shareAllowDownload,
      shareViewCount: updated.shareViewCount
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/code-projects/:id/collaborators
router.get('/:id/collaborators', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const project = await prisma.codeProject.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { collaborators: { include: { user: { select: { id: true, email: true, name: true, picture: true } } } } }
    })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    res.json(project.collaborators)
  } catch (err) {
    next(err)
  }
})

// POST /api/code-projects/:id/collaborators { email, role }
router.post('/:id/collaborators', requireAuth, validateParams(), validate(addCollaboratorSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { email, role: bodyRole } = req.body
    const role = bodyRole === 'EDITOR' ? 'EDITOR' : 'VIEWER'
    const project = await prisma.codeProject.findFirst({ where: { id, userId: req.user.id } })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(404).json({ error: 'User dengan email ini belum terdaftar' })
    if (user.id === req.user.id) return res.status(400).json({ error: 'Pemilik tidak perlu ditambahkan sebagai kolaborator' })
    const row = await prisma.codeProjectCollaborator.upsert({
      where: { codeProjectId_userId: { codeProjectId: id, userId: user.id } },
      update: { role },
      create: { codeProjectId: id, userId: user.id, role },
      include: { user: { select: { id: true, email: true, name: true, picture: true } } }
    })
    let emailStatus = 'sent'
    try {
      const emailResult = await sendCollaboratorInvite(email, project.name, req.user.name)
      if (emailResult?.id === 'skipped') {
        emailStatus = 'skipped'
      }
    } catch {
      emailStatus = 'failed'
    }
    res.json({ ...row, emailStatus })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/code-projects/:id/collaborators/:userId
router.delete('/:id/collaborators/:userId', requireAuth, validateParams(['id', 'userId']), async (req, res, next) => {
  try {
    const project = await prisma.codeProject.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    await prisma.codeProjectCollaborator.deleteMany({
      where: { codeProjectId: req.params.id, userId: req.params.userId }
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/code-projects/:id/versions - List snapshots
router.get('/:id/versions', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const project = await findAccessibleProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    const versions = await prisma.codeProjectVersion.findMany({
      where: { codeProjectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, createdAt: true }
    })
    res.json(versions)
  } catch (err) {
    next(err)
  }
})

// POST /api/code-projects/:id/versions - Save a snapshot of current files (keep last 20)
router.post('/:id/versions', requireAuth, validateParams(), validate(saveVersionSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const project = await findAccessibleProject(id, req.user.id, { edit: true })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    const label = (req.body?.label || '').trim() || `Snapshot ${new Date().toLocaleString('id-ID')}`
    const v = await prisma.codeProjectVersion.create({
      data: { codeProjectId: id, label, filesJson: project.filesJson }
    })
    // Prune to most recent 20.
    const all = await prisma.codeProjectVersion.findMany({ where: { codeProjectId: id }, orderBy: { createdAt: 'desc' }, select: { id: true } })
    if (all.length > 20) {
      await prisma.codeProjectVersion.deleteMany({ where: { id: { in: all.slice(20).map((x) => x.id) } } })
    }
    res.json({ id: v.id, label: v.label, createdAt: v.createdAt })
  } catch (err) {
    next(err)
  }
})

// GET /api/code-projects/:id/versions/:versionId - Inspect one snapshot
router.get('/:id/versions/:versionId', requireAuth, validateParams(['id', 'versionId']), async (req, res, next) => {
  try {
    const { id, versionId } = req.params
    const project = await findAccessibleProject(id, req.user.id)
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    const snap = await prisma.codeProjectVersion.findFirst({ where: { id: versionId, codeProjectId: id } })
    if (!snap) return res.status(404).json({ error: 'Snapshot tidak ditemukan' })
    res.json({ id: snap.id, label: snap.label, filesJson: snap.filesJson, createdAt: snap.createdAt })
  } catch (err) {
    next(err)
  }
})

// POST /api/code-projects/:id/versions/:versionId/restore - Restore files from a snapshot
router.post('/:id/versions/:versionId/restore', requireAuth, validateParams(['id', 'versionId']), async (req, res, next) => {
  try {
    const { id, versionId } = req.params
    const project = await findAccessibleProject(id, req.user.id, { edit: true })
    if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' })
    const snap = await prisma.codeProjectVersion.findFirst({ where: { id: versionId, codeProjectId: id } })
    if (!snap) return res.status(404).json({ error: 'Snapshot tidak ditemukan' })
    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.codeProject.updateMany({
      where: {
        id,
        OR: [
          { userId: req.user.id },
          { collaborators: { some: { userId: req.user.id, role: 'EDITOR' } } }
        ]
      },
      data: { filesJson: snap.filesJson }
    })
    if (updateResult.count === 0) return res.status(404).json({ error: 'Project tidak ditemukan' })

    const updated = await prisma.codeProject.findUnique({ where: { id } })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

const SKILL_PROMPTS = {
  'frontend-design': `
### SKILL: FRONTEND DESIGN (Intentional Visual Design Lead)
- Buatlah pilihan palet warna, tipografi, dan tata letak yang berani, matang, dan sangat spesifik dengan tema aplikasi (bukan template generik default).
- Tipografi: Pasangkan jenis huruf display dan body secara sengaja dengan skala tipe yang jelas, bobot/lebar yang disengaja, dan spasi yang rapi.
- Struktur visual: Elemen struktural seperti garis pemisah, label, subjudul harus memiliki makna fungsional, bukan hiasan kosong semata.
- Gerak/Motion: Terapkan animasi mikro yang halus (hover effects, transition transitions) dengan bijak. Jangan berlebihan agar tidak terkesan murahan atau hasil AI generik.
- Tulislah salinan teks (copywriting) yang interaktif dari sudut pandang pengguna aktif, gunakan kata kerja aktif (mis. "Simpan perubahan", bukan "Kirim").
- Hindari template visual klise seperti background krem polos dengan serif kontras tinggi, atau background hitam pekat dengan satu warna neon mencolok, kecuali jika diminta secara eksplisit.
`,
  'web-design-guidelines': `
### SKILL: WEB INTERFACE GUIDELINES (A11y, Performance & Typography Standards)
- Aksesibilitas (A11y): Tombol hanya ikon wajib memiliki \`aria-label\`. Kontrol input wajib terhubung dengan \`<label>\` atau memiliki \`aria-label\`. Ikon dekoratif wajib diberi \`aria-hidden="true"\`.
- Struktur HTML: Gunakan HTML5 semantik (\`<button>\` untuk aksi, \`<a>\` atau \`<Link>\` untuk navigasi, jangan gunakan \`<div onClick>\`). Headings wajib hierarkis (\`<h1>\`-\`<h6>\`).
- Input & Form: Field wajib memiliki \`autocomplete\` dan nama yang bermakna. Nonaktifkan spellcheck pada email, username, dan kode (\`spellCheck={false}\`). Tombol submit wajib menunjukkan indikator pemuatan (spinner/loading) saat pengiriman dimulai.
- Tipografi: Gunakan simbol \`…\` bukan \`...\`. Gunakan \`font-variant-numeric: tabular-nums\` pada kolom angka/harga. Gunakan \`text-wrap: balance\` pada judul/heading untuk menghindari widow.
- Penanganan Konten: Semua kontainer teks wajib mengantisipasi kata yang terlalu panjang dengan \`truncate\`, \`line-clamp\`, atau \`break-words\`. Flex-children membutuhkan \`min-w-0\` agar pemotongan teks berfungsi dengan benar.
- Gambar: Gambar wajib menyertakan atribut \`width\` dan \`height\` yang eksplisit untuk mencegah Cumulative Layout Shift (CLS), serta menggunakan \`loading="lazy"\` untuk elemen di bawah batas layar (below-the-fold).
`,
  'ui-ux-pro-max': `
### SKILL: UI/UX PRO MAX (UX Standards & Modern Layout Framework)
- Gunakan area sentuh yang nyaman pada interaksi mobile (min 44x44px untuk touch target). Sisipkan jarak antar target minimal 8px untuk mencegah salah pencet.
- Gunakan sistem skala spasi kelipatan 4pt/8dp secara konsisten untuk padding, margin, dan celah layout.
- Performa UI: Batasi kerja frame di main thread. Gunakan skeleton screen / shimmer daripada spinner berputar polos untuk operasi yang memakan waktu lama (>1 detik).
- Desain Light/Dark Mode: Pastikan rasio kontras teks utama minimal 4.5:1 terhadap background dalam tema terang maupun tema gelap. Batas pemisah (borders/dividers) harus terlihat jelas di kedua tema. Scrim modal background harus cukup gelap (biasanya hitam dengan opacity 40-60%) untuk mempertahankan fokus pada konten mengambang.
- Navigasi Konsisten: Navigasi utama tidak boleh dicampuradukkan secara acak. Logika kembali (back button) harus mempertahankan posisi scroll dan state filter sebelumnya.
- Grafik/Charts (Jika ada): Berikan visualisasi data yang responsif, lengkapi dengan legenda yang jelas dan tooltip interaktif yang dapat diakses melalui keyboard.
`,
  'vercel-react-best-practices': `
### SKILL: VERCEL REACT BEST PRACTICES
- Struktur Komponen: Pisahkan komponen menjadi file-file kecil yang modular, bersih, dan mudah dikelola (separation of concerns).
- Hooks & State: Gunakan \`useCallback\` untuk event handlers dan \`useMemo\` untuk kalkulasi berat guna menghindari render ulang yang tidak efisien.
- Keep State Local: Kelola state sedekat mungkin dengan tempat ia digunakan, hindari membagikan state global jika tidak diperlukan.
- Event Listeners: Selalu bersihkan (clean up) timers (\`clearTimeout\`/ \`clearInterval\`) dan event listeners pada pemanggilan return di \`useEffect\`.
`,
  'framer-motion-animations': `
### SKILL: FRAMER MOTION ANIMATIONS (Interactive UI/UX)
- Transisi & Easing: Gunakan transisi Framer Motion dengan easing \`easeOut\` atau efek pegas (\`spring\`) natural untuk animasi yang responsif.
- Stagger Effects: Gunakan \`staggerChildren\` untuk animasi masuk item list secara berurutan agar terkesan dinamis dan premium.
- Hover & Tap: Berikan efek hover (\`whileHover={{ scale: 1.015, translateY: -2 }}\`) dan tap (\`whileTap={{ scale: 0.985 }}\`) pada elemen kartu interaktif dan tombol.
- Transisi Halaman: Implementasikan \`AnimatePresence\` untuk modal/drawer agar dapat beranimasi memudar (fade out) dengan halus saat ditutup.
`,
  'react-performance-optimizer': `
### SKILL: REACT PERFORMANCE OPTIMIZER
- Minimalkan Rerenders: Gunakan \`React.memo\` untuk membungkus komponen anak yang menerima props yang stabil untuk mencegah rendering berulang.
- Virtualization: Untuk list panjang (>50 item), gunakan rendering virtual atau lazy loading agar render DOM awal tetap cepat dan ringan.
- Dynamic Imports: Pisahkan bundle berat (misal grafik/editor) menggunakan lazy loading (\`React.lazy\`) agar inisialisasi halaman instan.
`
}

// POST /api/code-projects/:id/stream - SSE code modification stream (AriseHash stream compiler)
router.post('/:id/stream', requireAuth, validateParams(), codeStreamLimiter, validate(streamCodeProjectSchema), async (req, res, next) => {
  const { id } = req.params
  const { instruction, messagesHistory, attachments, aiKeyId, activeSkills, customSkills } = req.body

  if (!instruction) return res.status(400).json({ error: 'instruksi wajib diisi' })

  // Resolve a custom (BYOK) model if requested; when present we skip quota.
  const customCfg = await resolveUserAiKey(req.user.id, aiKeyId)

  const creditCost = calculateCreditCost(instruction)

  // Enforce quota BEFORE any work (built-in models only; BYOK bypasses quota).
  const { quotaClaimed } = await tryClaimQuota(req, res, 'code', creditCost, customCfg)
  if (!quotaClaimed) return

  // Set SSE Headers
  setSSEHeaders(res)

  // Detect client disconnect
  let clientConnected = true
  req.on('close', () => { clientConnected = false })
  const safeWrite = (data) => {
    if (!clientConnected || res.destroyed) return false
    try { res.write(data); return true } catch { return false }
  }

  try {
    const project = await findAccessibleProject(id, req.user.id, { edit: true })
    if (!project) {
      if (quotaClaimed) await refundQuota(req.user.id, 'code', creditCost)
      safeWrite(`data: ${JSON.stringify({ error: 'Project tidak ditemukan' })}\n\n`)
      if (!res.destroyed) res.end()
      return
    }

    let currentFiles
    try {
      currentFiles = JSON.parse(project.filesJson)
    } catch {
      if (quotaClaimed) await refundQuota(req.user.id, 'code', creditCost)
      safeWrite(`data: ${JSON.stringify({ error: 'Data proyek rusak (filesJson tidak valid).' }) }\n\n`)
      if (!res.destroyed) res.end()
      return
    }
    const template = project.template || 'react'

    let skillsPromptText = ''
    if (Array.isArray(activeSkills)) {
      // Client sent an explicit list — honour it exactly, INCLUDING an empty
      // array (user turned every skill off → inject nothing).
      if (activeSkills.length > 0) {
        let body = ''
        activeSkills.forEach((sk) => {
          if (SKILL_PROMPTS[sk]) {
            body += SKILL_PROMPTS[sk] + '\n'
          } else if (sk.startsWith('custom-') && Array.isArray(customSkills)) {
            const custom = customSkills.find((c) => c.id === sk)
            if (custom) {
              body += `\n### SKILL: ${custom.name} (Custom User Skill)\n- ${custom.desc}\n`
            }
          }
        })
        if (body) skillsPromptText = `\n\n### PEDOMAN KUALITAS UI/UX & DESAIN YANG AKTIF:\n` + body
      }
    } else {
      // Field not provided at all → default to enabling all built-in skills.
      skillsPromptText = `\n\n### PEDOMAN KUALITAS UI/UX & DESAIN YANG AKTIF:\n` + Object.values(SKILL_PROMPTS).join('\n')
    }

    // Build the instruction payload
    const systemPrompt = `Anda adalah agen pemrograman senior (AriseHash).
Tugas Anda adalah memodifikasi atau membuat kode file dalam workspace.
${promptHintFor(template)}

Berikut file yang saat ini ada di workspace:
${Object.entries(currentFiles).map(([path, code]) => `=== FILE PATH: ${path} ===\n${code}\n=== END FILE ===`).join('\n\n')}

Keluarkan kode dalam format tag kustom XML:
<vcFile path="/App.js">
// Kode lengkap file baru di sini
</vcFile>

Aturan Penting:
1. Sesuaikan bahasa, ekstensi file, dan sintaks dengan stack di atas. JANGAN campur framework lain.
2. Selalu kembalikan ISI FILE LENGKAP dalam tag <vcFile>. Jangan diff/potongan parsial.
3. Boleh membuat file baru dengan menentukan path di <vcFile path="...">.
4. Jika butuh dependensi npm baru, tambahkan ke /package.json (kembalikan /package.json lengkap dalam <vcFile>).
5. Tulis kode yang bersih, aman, bebas sintaks error, dan fungsional. Buat UI yang rapi dan modern.
6. Jika ada gambar/file referensi yang dilampirkan user, ikuti desain/struktur tersebut semirip mungkin. ${skillsPromptText}`

    // Compose the user message. If attachments are present (images), use the
    // OpenAI multimodal content array; text files are embedded inline.
    const imageAtts = Array.isArray(attachments) ? attachments.filter((a) => a?.type === 'image' && a.dataUrl) : []
    const textAtts = Array.isArray(attachments) ? attachments.filter((a) => a?.type === 'text' && a.content) : []

    let userText = instruction
    if (textAtts.length) {
      userText += '\n\n' + textAtts.map((f) => `=== FILE REFERENSI: ${f.name || 'lampiran'} ===\n${String(f.content).slice(0, 8000)}\n=== END ===`).join('\n\n')
    }

    let userMessage
    if (imageAtts.length) {
      userMessage = {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          ...imageAtts.slice(0, 4).map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
        ],
      }
    } else {
      userMessage = { role: 'user', content: userText }
    }

    // Trim history so the prompt stays bounded as the conversation grows
    // (mirrors the chat route). Keep only the most recent turns.
    const MAX_HISTORY = 20
    const history = Array.isArray(messagesHistory) ? messagesHistory : []
    const trimmedHistory = history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history

    const promptMessages = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory,
      userMessage
    ]

    let accumulatedContent = ''
    await streamCompletion(promptMessages, (token) => {
      if (!clientConnected) throw new Error('Koneksi terputus oleh pengguna')
      accumulatedContent += token
      if (accumulatedContent.length > MAX_AI_RESPONSE_LENGTH) {
        throw new Error('Respons AI melebihi batas maksimum (500.000 karakter)')
      }
      safeWrite(`data: ${JSON.stringify({ token })}\n\n`)
    }, req.user.id, req.body.model || null, customCfg)

    // Parse files updated from XML tag format: <vcFile path="(.+?)">([\s\S]*?)(?:<\/vcFile>|$)
    const regex = /<vcFile\s+path="([^"]+)">([\s\S]*?)(?:<\/vcFile>|$)/g
    let match
    const updatedFiles = { ...currentFiles }
    let filesUpdatedCount = 0
    const updatedPaths = []

    // Normalise & reject unsafe paths from AI output. A model can be tricked
    // into emitting "/../../etc/passwd" or "../evil.js"; those would poison the
    // workspace and cause a ZIP-slip on export. Force a single leading slash,
    // drop any path that still contains a ".." traversal segment.
    const safeProjectPath = (raw) => {
      if (!raw) return null
      let p = String(raw).trim().replace(/\\/g, '/')
      if (!p.startsWith('/')) p = '/' + p
      // Collapse duplicate slashes but keep the code content untouched.
      p = p.replace(/\/{2,}/g, '/')
      if (p.split('/').some((seg) => seg === '..')) return null
      return p
    }

    while ((match = regex.exec(accumulatedContent)) !== null) {
      const filePath = safeProjectPath(match[1])
      const fileCode = match[2].trim()
      if (filePath) {
        updatedFiles[filePath] = fileCode
        filesUpdatedCount++
        if (!updatedPaths.includes(filePath)) updatedPaths.push(filePath)
      }
    }

    // Fallback: some models ignore the <vcFile> format and emit fenced code
    // blocks that declare a path in the info string, e.g. ```jsx /App.js.
    // Only triggers when the primary parse found nothing (safe — needs a path).
    if (filesUpdatedCount === 0) {
      const fenceRe = /```[a-zA-Z0-9+#-]*[ \t]+((?:\.\/|\/)[^\s`]+)\n([\s\S]*?)```/g
      let fm
      while ((fm = fenceRe.exec(accumulatedContent)) !== null) {
        const p = safeProjectPath(fm[1].replace(/^\.\//, '/'))
        if (!p) continue
        updatedFiles[p] = fm[2].trim()
        filesUpdatedCount++
        if (!updatedPaths.includes(p)) updatedPaths.push(p)
      }
    }

    // Save changes to database if files were updated
    if (filesUpdatedCount > 0) {
      // Snapshot the PREVIOUS state before overwriting (so user can restore).
      try {
        await prisma.codeProjectVersion.create({
          data: { codeProjectId: id, label: 'Sebelum perubahan AI', filesJson: project.filesJson }
        })
        const all = await prisma.codeProjectVersion.findMany({ where: { codeProjectId: id }, orderBy: { createdAt: 'desc' }, select: { id: true } })
        if (all.length > 20) {
          await prisma.codeProjectVersion.deleteMany({ where: { id: { in: all.slice(20).map((x) => x.id) } } })
        }
      } catch { /* snapshot best-effort */ }

      // Atomic update with ownership check (prevents TOCTOU race)
      const updateResult = await prisma.codeProject.updateMany({
        where: { id, userId: req.user.id },
        data: {
          filesJson: JSON.stringify(updatedFiles)
        }
      })
      // If update failed due to ownership change, silently ignore — user would not own project anyway
    } else if (quotaClaimed) {
      // Model produced no usable files (didn't follow the output format).
      // Don't charge the user for a no-op turn.
      await refundQuota(req.user.id, 'code', creditCost)
    }

    safeWrite(`data: ${JSON.stringify({ done: true, filesUpdated: filesUpdatedCount, updatedPaths, validationWarnings: validateGeneratedFiles(updatedFiles) })}\n\n`)
    if (!res.destroyed) res.end()
  } catch (err) {
    logError('Stream Code', 'Failed', err)
    if (quotaClaimed) await refundQuota(req.user.id, 'code', creditCost)
    safeWrite(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    if (!res.destroyed) res.end()
  }
})

export default router
