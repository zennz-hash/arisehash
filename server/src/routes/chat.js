import { Router } from 'express'
import path from 'node:path'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { streamCompletion } from '../utils/ai.js'
import { claimQuota, refundQuota, calculateCreditCost, tryClaimQuota } from '../utils/quota.js'
import { resolveUserAiKey } from './aiKeys.js'
import { validate, validateParams, ID_RE } from '../middleware/validate.js'
import { createChatSchema, updateChatSchema, sendMessageSchema, analyzeGithubSchema, updateMessageSchema } from '../schemas/chat.schema.js'
import { createRateLimit } from '../middleware/rateLimit.js'
import { setSSEHeaders, MAX_AI_RESPONSE_LENGTH } from '../utils/stream.js'
import { logError } from '../utils/logger.js'
import { parsePagination, paginatedResponse } from '../utils/pagination.js'

import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB

const SYSTEM_PROMPT = `Anda adalah AriseHash, asisten rekayasa perangkat lunak yang cerdas, ramah, dan teliti.
Jawab dalam bahasa yang sama dengan pertanyaan pengguna (default Bahasa Indonesia).
DILARANG KERAS menggunakan emoji atau ikon grafis apa pun (seperti 👋, 🚀, 👍, 🤖, dll.) dalam tanggapan Anda. Tulis jawaban Anda dalam format teks murni yang bersih tanpa elemen emoji.
Gunakan format Markdown yang rapi: judul, daftar, tabel, dan blok kode berlabel bahasa (mis. \`\`\`jsx).
Saat memberi kode, tulis kode yang lengkap, aman, dan dapat langsung dijalankan.
Jelaskan alasan di balik keputusan teknis secara ringkas namun bermakna.`

// GET /api/chat - List user's conversations (paginated, without messages)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query)

    const where = { userId: req.user.id }
    const [total, chats] = await Promise.all([
      prisma.chat.count({ where }),
      prisma.chat.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, title: true, mode: true, createdAt: true, updatedAt: true }
      })
    ])
    res.json(paginatedResponse(chats, total, page, pageSize))
  } catch (err) {
    next(err)
  }
})

// POST /api/chat - Create a new conversation
router.post('/', requireAuth, validate(createChatSchema), async (req, res, next) => {
  try {
    const model = req.body?.model || 'standard'
    const aiKeyId = req.body?.aiKeyId || null
    const chat = await prisma.chat.create({
      data: { userId: req.user.id, mode: model, aiKeyId, title: 'Percakapan Baru' }
    })
    res.json(chat)
  } catch (err) {
    next(err)
  }
})

// GET /api/chat/:id - Load a conversation with its messages
router.get('/:id', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    })
    if (!chat) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })
    res.json(chat)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/chat/:id - Rename or change a conversation's default model
router.patch('/:id', requireAuth, validateParams(), validate(updateChatSchema), async (req, res, next) => {
  try {
    const { title, model, aiKeyId } = req.body
    const chat = await prisma.chat.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!chat) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })

    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.chat.updateMany({
      where: { id: chat.id, userId: req.user.id },
      data: {
        title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : chat.title,
        mode: typeof model === 'string' ? model : chat.mode,
        aiKeyId: aiKeyId !== undefined ? aiKeyId : chat.aiKeyId
      }
    })
    if (updateResult.count === 0) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })

    const updated = await prisma.chat.findUnique({ where: { id: chat.id } })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/chat/:id - Delete a conversation
router.delete('/:id', requireAuth, validateParams(), async (req, res, next) => {
  try {
    const deleteResult = await prisma.chat.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (deleteResult.count === 0) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/:id/upload-file - Upload a file to chat context
router.post('/:id/upload-file', requireAuth, validateParams(), upload.single('file'), async (req, res, next) => {
  try {
    const { id } = req.params
    const chat = await prisma.chat.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!chat) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })

    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' })

    // Sanitize filename to prevent path traversal
    const fileName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileType = req.file.mimetype
    const fileData = req.file.buffer.toString('base64')

    // Validate file extension against whitelist
    const ext = path.extname(fileName).toLowerCase()
    const allowedExts = new Set(['.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.java', '.rb', '.php', '.c', '.cpp', '.h', '.json', '.xml', '.yaml', '.yml', '.css', '.scss', '.html', '.sql', '.sh', '.csv', '.log', '.png', '.jpg', '.jpeg', '.webp', '.gif'])
    if (!allowedExts.has(ext)) {
      return res.status(400).json({ error: 'Ekstensi file tidak didukung.' })
    }

    // Validate actual content (magic bytes for images)
    const buf = req.file.buffer
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8
    const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
    const isWebp = buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50

    const isImage = ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.gif'
    const isText = !isImage

    // If client claims image but magic bytes don't match, reject
    if (isImage && !(isPng || isJpeg || isGif || isWebp)) {
      return res.status(400).json({ error: 'File gambar tidak valid atau rusak.' })
    }

    const fileSize = req.file.size

    let content = ''
    if (isImage) {
      // Store image reference inline
      content = `[Upload Gambar: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)]\n\nGambar akan diproses sebagai konteks visual untuk analisis.`
    } else if (isText) {
      const textPreview = req.file.buffer.slice(0, 8000).toString('utf-8')
      content = `[Upload File: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)]\n\n\`\`\`\n${textPreview}\n\`\`\``
    } else {
      content = `[Upload File: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)]\n\nFile ini telah diupload sebagai referensi.`
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content,
        mode: chat.mode
      }
    })

    res.json({ message, fileName, fileSize, isImage })
  } catch (err) {
    next(err)
  }
})

// POST /api/chat/:id/analyze-github - Analyzes a GitHub repository and adds code context
router.post('/:id/analyze-github', requireAuth, validateParams(), validate(analyzeGithubSchema), async (req, res, next) => {
  try {
    const { id } = req.params
    const { url } = req.body

    const chat = await prisma.chat.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!chat) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })

    // Parse and validate GitHub URL
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return res.status(400).json({ error: 'URL GitHub tidak valid. Format: https://github.com/owner/repo' })
    }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.hostname !== 'github.com') {
      return res.status(400).json({ error: 'URL GitHub tidak valid. Format: https://github.com/owner/repo' })
    }
    const pathParts = parsed.pathname.replace(/^\/|\/$/g, '').split('/')
    if (pathParts.length < 2) {
      return res.status(400).json({ error: 'URL GitHub tidak valid. Format: https://github.com/owner/repo' })
    }
    const owner = pathParts[0]
    const repo = pathParts[1].replace(/\.git$/, '')

    async function fetchGh(path) {
      const r = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        headers: { 'User-Agent': 'AriseHash/1.0', Accept: 'application/vnd.github.v3+json' }
      })
      if (!r.ok) throw new Error(`GitHub API: ${r.status} ${r.statusText}`)
      return r.json()
    }

    // Fetch repo info and root contents
    const [repoInfo, contents] = await Promise.all([
      fetchGh(''),
      fetchGh('/contents')
    ])

    // Fetch a few key files for analysis
    const keyFiles = ['README.md', 'package.json', 'src/', 'index.js', 'index.ts', 'main.py', 'requirements.txt', 'go.mod']
    const codeBlocks = []

    // Helper to fetch file content
    async function fetchFileContent(item) {
      if (item.type !== 'file') return null
      try {
        const r = await fetch(item.download_url, { headers: { 'User-Agent': 'AriseHash/1.0' } })
        if (!r.ok) return null
        const text = await r.text()
        return { name: item.path, content: text.slice(0, 3000) }
      } catch { return null }
    }

    // Try to fetch key files from contents
    const fetchPromises = []
    for (const item of contents) {
      if (keyFiles.some(k => item.name.toLowerCase() === k.toLowerCase() || item.name.startsWith(k.replace('/', '')))) {
        fetchPromises.push(fetchFileContent(item))
      }
    }
    const fetchedFiles = (await Promise.all(fetchPromises)).filter(Boolean)

    for (const f of fetchedFiles) {
      const ext = f.name.split('.').pop()
      codeBlocks.push(`### \`${f.name}\`\n\n\`\`\`${ext}\n${f.content}\n\`\`\``)
    }

    // Format as a user message
    const content = `[Analisis GitHub: ${owner}/${repo}]\n\n**Repo:** ${repoInfo.full_name || `${owner}/${repo}`}\n**Deskripsi:** ${repoInfo.description || 'Tidak ada deskripsi'}\n**Stars:** ${repoInfo.stargazers_count || 0} · **Forks:** ${repoInfo.forks_count || 0} · **Bahasa:** ${repoInfo.language || 'N/A'}\n**URL:** ${url}\n\n---\n\n**File-file kunci:**\n\n${codeBlocks.length > 0 ? codeBlocks.join('\n\n') : '*Tidak ada file kunci yang bisa di-fetch. Minta bantuan untuk clone repo ini.*'}\n\n---\n\nAnalisis struktur, arsitektur, dan kualitas kode dari repositori di atas.`

    const message = await prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content,
        mode: chat.mode
      }
    })

    res.json({ message, repoInfo: { name: repoInfo.full_name || `${owner}/${repo}`, stars: repoInfo.stargazers_count, language: repoInfo.language } })
  } catch (err) {
    next(err)
  }
})

const chatMessageLimiter = createRateLimit({ windowMs: 60_000, maxRequests: 10 })

// POST /api/chat/:id/message - Send a message and stream the assistant reply (SSE)
router.post('/:id/message', requireAuth, chatMessageLimiter, validateParams(), validate(sendMessageSchema), async (req, res, next) => {
  const { id } = req.params
  const { content, model: bodyModel, aiKeyId, deepSearch } = req.body

  const chat = await prisma.chat.findFirst({
    where: { id, userId: req.user.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  })
  if (!chat) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })

  // Hanya gunakan modelId yang valid (CUID/admin key ID), bukan mode name ("standard"/"max")
  const bodyModelId = bodyModel && ID_RE.test(bodyModel) ? bodyModel : null
  const chatModeId = chat.mode && ID_RE.test(chat.mode) ? chat.mode : null
  const model = bodyModelId || chatModeId || null

  const customCfg = await resolveUserAiKey(req.user.id, aiKeyId)

  const creditCost = calculateCreditCost(content)

  // Enforce quota BEFORE any work (built-in models only; BYOK bypasses quota).
  const { quotaClaimed } = await tryClaimQuota(req, res, 'code', creditCost, customCfg)
  if (!quotaClaimed) return

  // Persist the user's message immediately.
  const userMessage = await prisma.chatMessage.create({
    data: { chatId: chat.id, role: 'user', content: content.trim(), mode: model }
  })

  // Build the prompt from prior history + new message.
  const MAX_HISTORY = 40
  const history = chat.messages.map((m) => ({ role: m.role, content: m.content }))
  const trimmedHistory = history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history

  // Prepare system prompt with optional deep search instruction
  let systemPrompt = SYSTEM_PROMPT
  if (deepSearch) {
    systemPrompt += `\n\n**Mode Pencarian Mendalam:**\nLakukan analisis yang sangat mendalam, detail, dan komprehensif.\n- Jelaskan setiap konsep secara menyeluruh\n- Berikan contoh konkret dan implementasi\n- Sertakan analisis trade-off, edge cases, dan best practices\n- Jangan ragu untuk mengeksplorasi berbagai sudut pandang\n- Gunakan lebih banyak token untuk memastikan kelengkapan jawaban`
  }

  const promptMessages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: content.trim() }
  ]

  // SSE headers
  setSSEHeaders(res)

  // Detect client disconnect — stop writing & abort stream to prevent resource leak.
  let clientConnected = true
  req.on('close', () => {
    clientConnected = false
  })
  const safeWrite = (data) => {
    if (!clientConnected || res.destroyed) return false
    try { res.write(data); return true } catch { return false }
  }

  // Inform the client which model/message ids are in play.
  safeWrite(`data: ${JSON.stringify({ meta: true, model, userMessageId: userMessage.id })}\n\n`)

  let accumulated = ''
  try {
    await streamCompletion(promptMessages, (token) => {
      if (!clientConnected) {
        throw new Error('Koneksi terputus oleh pengguna')
      }
      accumulated += token
      if (accumulated.length > MAX_AI_RESPONSE_LENGTH) {
        throw new Error('Respons AI melebihi batas maksimum (500.000 karakter)')
      }
      safeWrite(`data: ${JSON.stringify({ token })}\n\n`)
    }, req.user.id, model, customCfg)

    if (!clientConnected) {
      // Client sudah pergi, refund quota & bersihkan user message.
      if (quotaClaimed) await refundQuota(req.user.id, 'code', creditCost)
      await prisma.chatMessage.delete({ where: { id: userMessage.id } }).catch(() => {})
      if (!res.destroyed) res.end()
      return
    }

    // Persist the assistant reply.
    const assistantMessage = await prisma.chatMessage.create({
      data: { chatId: chat.id, role: 'assistant', content: accumulated, mode: model }
    })

    // Auto-title the conversation from the first user message.
    const dataUpdate = { updatedAt: new Date() }
    if (chat.messages.length === 0 || chat.title === 'Percakapan Baru') {
      const truncated = content.trim().slice(0, 57)
      dataUpdate.title = content.trim().length > 60 ? truncated + '...' : truncated
    }
    // Atomic update with ownership check (prevents TOCTOU race)
    const updateResult = await prisma.chat.updateMany({
      where: { id: chat.id, userId: req.user.id },
      data: dataUpdate
    })
    if (updateResult.count === 0) {
      safeWrite(`data: ${JSON.stringify({ error: 'Percakapan tidak ditemukan' })}\n\n`)
      if (!res.destroyed) res.end()
      return
    }

    safeWrite(`data: ${JSON.stringify({ done: true, assistantMessageId: assistantMessage.id })}\n\n`)
    if (!res.destroyed) res.end()
  } catch (err) {
    logError('Chat Stream', 'failed', err)
    if (quotaClaimed) await refundQuota(req.user.id, 'code', creditCost)
    // Jangan hapus user message — frontend sudah terima meta event.
    // Partial content tidak dipersist untuk hindari duplikasi.
    safeWrite(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    if (!res.destroyed) res.end()
  }
})

// PATCH /api/chat/:id/messages/:messageId - Update a message content
router.patch('/:id/messages/:messageId', requireAuth, validateParams(['id', 'messageId']), validate(updateMessageSchema), async (req, res, next) => {
  try {
    const { id, messageId } = req.params
    const { content } = req.body

    const chat = await prisma.chat.findFirst({
      where: { id, userId: req.user.id }
    })
    if (!chat) return res.status(404).json({ error: 'Percakapan tidak ditemukan' })

    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, chatId: id }
    })
    if (!message) return res.status(404).json({ error: 'Pesan tidak ditemukan' })
    if (message.role !== 'user') return res.status(403).json({ error: 'Hanya pesan pengguna yang dapat diedit' })

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { content: content.trim() }
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
