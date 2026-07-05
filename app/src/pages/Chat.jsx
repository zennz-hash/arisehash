import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Zap } from 'lucide-react'
import { api, authHeaders } from '../api.js'
import { parseModelSelection, buildModelOptions, getModelLabel } from '../model-utils.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { API_BASE } from '../config.js'
import { readSSEStream, SSEError } from '../utils/sse.js'
import { formatTime } from '../utils/time.js'
import { useAdminModels } from '../utils/useAdminModels.js'
import ChatSidebar from '../components/ChatSidebar.jsx'
import ChatTopBar from '../components/ChatTopBar.jsx'
import ChatThread from '../components/ChatThread.jsx'
import ChatComposer from '../components/ChatComposer.jsx'
import ChatWelcome from '../components/ChatWelcome.jsx'

/* ── Constants ──────────────────────────────────────────────────────────── */
const MAX_CHARS = 10000
const MAX_IMAGES = 4
const MAX_ATTACHMENT_SIZE_MB = 25
const ACCEPTED_FILE_TYPES = '.txt,.md,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.rb,.php,.css,.scss,.html,.json,.yaml,.yml,.xml,.csv,.sh,.sql'
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif'

/* ── Main Chat Component ────────────────────────────────────────────────── */
export default function Chat() {
  const { user, ready } = useAuth()
  const { t } = useLang()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  /* ── State ────────────────────────────────────────────────────────────── */
  const [chats, setChats] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(null)
  const { adminModels, aiKeys } = useAdminModels(user)
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [quota, setQuota] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [renamingChatId, setRenamingChatId] = useState(null)
  const [renameText, setRenameText] = useState('')
  const [deepSearch, setDeepSearch] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([])
  const [attachedImages, setAttachedImages] = useState([])
  const [githubUrl, setGithubUrl] = useState('')
  const [showGithubInput, setShowGithubInput] = useState(false)
  const [analyzingGithub, setAnalyzingGithub] = useState(false)
  const [uploading, setUploading] = useState(false)

  /* ── Refs ─────────────────────────────────────────────────────────────── */
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const abortRef = useRef(null)
  const sendingRef = useRef(false)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamText, scrollToBottom])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
  }, [])

  /* ── Data loading ─────────────────────────────────────────────────────── */
  const loadChats = useCallback(async () => {
    try {
      const res = await api.chats()
      const list = res?.items || res || []
      setChats(list)
      return list
    } catch (err) { addToast(err.message, 'error'); return [] }
  }, [addToast])

  const loadQuota = useCallback(async () => {
    try { setQuota(await api.quota()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!user) return
    loadChats(); loadQuota()
  }, [user, loadChats, loadQuota])

  useEffect(() => {
    if (adminModels.length > 0 && quota && model === null) {
      const planType = user?.role === 'ADMIN' ? 'ADMIN' : quota.planType
      if (planType === 'FREE') {
        const freeModel = adminModels.find((m) => m.model.startsWith('mimo-v2.5'))
        setModel(freeModel?.id || adminModels[0].id)
      } else {
        setModel(adminModels[0].id)
      }
    }
  }, [adminModels, quota, user, model])

  /* ── Chat CRUD ────────────────────────────────────────────────────────── */
  const openChat = useCallback(async (id) => {
    try {
      const chat = await api.getChat(id)
      setActiveId(chat.id)
      setSearchParams({ id: chat.id })
      if (chat.aiKeyId) setModel(`key:${chat.aiKeyId}`)
      else setModel(chat.mode || adminModels[0]?.id || null)
      setMessages(chat.messages || [])
      setSidebarOpen(false)
      setEditingMsgId(null)
    } catch (err) { addToast(err.message, 'error') }
  }, [addToast, setSearchParams, adminModels])

  const hasOpenedRef = useRef(false)
  useEffect(() => {
    if (!user || adminModels.length === 0 || hasOpenedRef.current) return
    const urlId = searchParams.get('id')
    if (urlId) { hasOpenedRef.current = true; openChat(urlId) }
  }, [user, adminModels, searchParams, openChat])

  const newChat = useCallback(() => {
    setActiveId(null); setSearchParams({}); setMessages([])
    setStreamText(''); setSidebarOpen(false); setEditingMsgId(null)
    taRef.current?.focus()
  }, [setSearchParams])

  const removeChat = useCallback(async (id, e) => {
    e?.stopPropagation()
    const ok = await confirm({ title: 'Hapus Percakapan', message: 'Percakapan ini akan dihapus permanen. Yakin?', confirmText: 'Hapus', danger: true })
    if (!ok) return
    try {
      await api.deleteChat(id)
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (activeId === id) newChat()
      addToast('Percakapan dihapus', 'success')
    } catch (err) { addToast(err.message, 'error') }
  }, [activeId, newChat, addToast, confirm])

  const deleteAllChats = useCallback(async () => {
    if (chats.length === 0) return
    const ok = await confirm({ title: 'Hapus Semua Percakapan', message: `Semua ${chats.length} percakapan akan dihapus permanen.`, confirmText: 'Hapus Semua', danger: true })
    if (!ok) return
    let success = 0
    for (const c of chats) { try { await api.deleteChat(c.id); success++ } catch { /* */ } }
    setChats([]); newChat()
    addToast(`${success} percakapan dihapus`, 'success')
  }, [chats, confirm, newChat, addToast])

  /* ── Inline Rename ────────────────────────────────────────────────────── */
  const startRename = useCallback((id, currentTitle) => {
    setRenamingChatId(id); setRenameText(currentTitle || '')
    setTimeout(() => renameInputRef.current?.select(), 50)
  }, [])

  const commitRename = useCallback(async () => {
    const id = renamingChatId; const title = renameText.trim()
    if (!id || !title) { setRenamingChatId(null); return }
    try {
      await api.renameChat(id, title)
      setChats((prev) => prev.map((c) => c.id === id ? { ...c, title } : c))
      addToast('Nama percakapan diubah', 'success')
    } catch (err) { addToast(err.message, 'error') }
    setRenamingChatId(null)
  }, [renamingChatId, renameText, addToast])

  /* ── Message Edit ─────────────────────────────────────────────────────── */
  const startEdit = useCallback((msg) => {
    setEditingMsgId(msg.id); setEditingText(msg.content)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }, [])

  const cancelEdit = useCallback(() => { setEditingMsgId(null); setEditingText('') }, [])

  const commitEdit = useCallback(async () => {
    const trimmed = editingText.trim()
    if (!trimmed || !editingMsgId) { cancelEdit(); return }
    try {
      await api.updateMessage(activeId, editingMsgId, trimmed)
      setMessages((prev) => prev.map((m) => m.id === editingMsgId ? { ...m, content: trimmed } : m))
      addToast('Pesan diperbarui.', 'success')
    } catch (err) { addToast(err.message, 'error') }
    setEditingMsgId(null); setEditingText('')
  }, [editingText, editingMsgId, activeId, cancelEdit, addToast])

  /* ── File / Image / GitHub handlers ──────────────────────────────────── */
  const ensureChatId = useCallback(async () => {
    if (activeId) return activeId
    const { model: payloadModel, aiKeyId: payloadAiKeyId } = parseModelSelection(model)
    const created = await api.createChat(payloadModel, payloadAiKeyId)
    setActiveId(created.id); setSearchParams({ id: created.id })
    setChats((prev) => [{ ...created }, ...prev])
    return created.id
  }, [activeId, model, setSearchParams])

  const triggerFilePicker = useCallback(async () => {
    try { await ensureChatId(); fileInputRef.current?.click() }
    catch (err) { addToast(err.message, 'error') }
  }, [ensureChatId, addToast])

  const triggerImagePicker = useCallback(async () => {
    try { await ensureChatId(); imageInputRef.current?.click() }
    catch (err) { addToast(err.message, 'error') }
  }, [ensureChatId, addToast])

  const toggleGithubInput = useCallback(async () => {
    try { await ensureChatId(); setShowGithubInput((v) => !v) }
    catch (err) { addToast(err.message, 'error') }
  }, [ensureChatId, addToast])

  const handleFileAttach = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !activeId) return
    setUploading(true)
    for (const file of files) {
      try {
        const result = await api.uploadFile(activeId, file)
        setAttachedFiles((prev) => [...prev, { name: file.name, size: file.size, result }])
        if (result.message) setMessages((prev) => [...prev, result.message])
        addToast(`File diupload: ${file.name}`, 'success')
      } catch (err) { addToast(`Gagal upload ${file.name}: ${err.message}`, 'error') }
    }
    setUploading(false); e.target.value = ''
  }, [activeId, addToast])

  const handleImageAttach = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newImages = []
    for (const file of files) {
      if (attachedImages.length + newImages.length >= MAX_IMAGES) {
        addToast(`Maksimal ${MAX_IMAGES} gambar. ${files.length - newImages.length} gambar dilewati.`, 'warning')
        break
      }
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      })
      if (dataUrl) newImages.push({ name: file.name, data: dataUrl, file })
    }
    if (newImages.length > 0) setAttachedImages((prev) => [...prev, ...newImages])
    e.target.value = ''
  }, [attachedImages.length, addToast])

  const removeFile = useCallback((index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeImage = useCallback((index) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }, [])

  const handleGithubAnalyze = useCallback(async () => {
    const url = githubUrl.trim()
    if (!url || !activeId || analyzingGithub) return
    setAnalyzingGithub(true)
    try {
      const result = await api.analyzeGithub(activeId, url)
      setMessages((prev) => [...prev, result.message])
      setGithubUrl(''); setShowGithubInput(false)
      addToast(`Repo ${result.repoInfo?.name || ''} dianalisis`, 'success')
    } catch (err) { addToast(err.message, 'error') }
    setAnalyzingGithub(false)
  }, [githubUrl, activeId, analyzingGithub, addToast])

  /* ── Send & Stream ────────────────────────────────────────────────────── */
  const send = useCallback(async (options = {}) => {
    const opts = options?.nativeEvent ? {} : options
    const appendUser = opts.appendUser !== false
    const filesForMessage = opts.files || attachedFiles
    const imagesForMessage = opts.images || attachedImages
    const content = (typeof opts.content === 'string' ? opts.content : input).trim()
    if (!content || streaming || sendingRef.current) return
    sendingRef.current = true

    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    if (!opts.keepInput) setInput('')
    setStreamText('')

    let chatId = activeId
    const { model: payloadModel, aiKeyId: payloadAiKeyId } = parseModelSelection(model)
    try {
      if (!chatId) {
        const created = await api.createChat(payloadModel, payloadAiKeyId)
        chatId = created.id; setActiveId(chatId)
        setChats((prev) => [{ ...created }, ...prev])
      }
    } catch (err) {
      addToast(err.message, 'error')
      setStreaming(false); if (!opts.keepInput) setInput(content)
      abortRef.current = null; sendingRef.current = false; return
    }

    // Build message content including file and image attachments
    let msgContent = content
    const fileMD = filesForMessage.map((f) => `[Lampiran: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]`).join('\n')
    if (imagesForMessage.length > 0) {
      const imgMD = imagesForMessage.map((img) => `![${img.name}](${img.data})`).join('\n')
      msgContent = content ? `${content}\n\n${fileMD}\n${imgMD}` : `${fileMD}\n${imgMD}`
    } else if (filesForMessage.length > 0) {
      msgContent = content ? `${content}\n\n${fileMD}` : fileMD
    }

    const totalSizeMB = imagesForMessage.reduce((sum, img) => sum + (img.data?.length || 0), 0) / (1024 * 1024)
    if (totalSizeMB > MAX_ATTACHMENT_SIZE_MB) {
      addToast(`Total ukuran gambar ${totalSizeMB.toFixed(1)}MB melebihi batas ${MAX_ATTACHMENT_SIZE_MB}MB. Resiko gagal stream.`, 'warning')
    }

    if (appendUser) {
      setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content: msgContent, model }])
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat/${chatId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders('POST') },
        body: JSON.stringify({ content: msgContent, model: payloadModel, aiKeyId: payloadAiKeyId, deepSearch }),
        credentials: 'include',
        signal: controller.signal
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal mengirim pesan')
      }

      const acc = await readSSEStream(res, {
        onChunk: (chunk) => setStreamText((prev) => prev + chunk),
        signal: controller.signal
      })

      if (controller.signal.aborted) {
        if (acc.trim()) setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: acc + '\n\n*[Dihentikan]*', model }])
        setStreamText('')
      } else {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: acc, model }])
        setStreamText('')
        if (appendUser) { setAttachedFiles([]); setAttachedImages([]) }
        await Promise.all([loadChats(), loadQuota()])
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setStreamText('')
      } else if (err instanceof SSEError) {
        addToast(err.message, 'error')
        if (err.accumulated?.trim()) setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: err.accumulated, model }])
        setStreamText('')
      } else {
        addToast(err.message, 'error'); setStreamText('')
      }
    } finally {
      abortRef.current = null; setStreaming(false); sendingRef.current = false
    }
  }, [input, streaming, activeId, model, deepSearch, attachedFiles, attachedImages, addToast, loadChats, loadQuota])

  /* ── Build code in Sandbox ────────────────────────────────────────────── */
  const buildCode = useCallback(async (code) => {
    try {
      addToast('Menyiapkan workspace Sandbox...', 'info')
      const { model: payloadModel, aiKeyId: payloadAiKeyId } = parseModelSelection(model)
      const project = await api.createCodeProject('Dari Chat', null, null, payloadModel, payloadAiKeyId)
      const files = JSON.parse(project.filesJson || '{}')
      files['/App.jsx'] = code
      await api.saveCodeProject(project.id, JSON.stringify(files), project.messagesJson || '[]', project.name)
      navigate(`/app/ide/${project.id}`)
    } catch (err) { addToast(err.message, 'error') }
  }, [addToast, model, navigate])

  /* ── Regenerate ───────────────────────────────────────────────────────── */
  const regenerate = useCallback(async (lastUserMsg) => {
    if (!lastUserMsg || streaming) return
    if (!activeId) { addToast('Percakapan belum siap untuk dicoba ulang.', 'error'); return }
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.role === 'user' && m.id === lastUserMsg.id)
      return idx < 0 ? prev : prev.slice(0, idx + 1)
    })
    await send({ content: lastUserMsg.content, appendUser: false, files: [], images: [] })
  }, [streaming, activeId, send, addToast])

  /* ── Export ────────────────────────────────────────────────────────────── */
  const exportChat = useCallback(() => {
    if (messages.length === 0) return
    const lines = [`# AriseHash Chat — ${new Date().toLocaleDateString('id-ID')}`, '']
    messages.forEach((m) => {
      const label = m.role === 'user' ? 'User' : 'AriseHash'
      lines.push(`## ${label}${m.createdAt ? ` (${formatTime(m.createdAt)})` : ''}`, '', m.content, '')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `chat-${activeId || 'export'}-${Date.now()}.md`
    a.click(); URL.revokeObjectURL(url)
    addToast('Chat diunduh sebagai markdown', 'success')
  }, [messages, activeId, addToast])

  /* ── Keyboard ──────────────────────────────────────────────────────────── */
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (editingMsgId) { commitEdit(); return }; send() }
    if (e.key === 'Escape' && editingMsgId) cancelEdit()
  }

  useEffect(() => {
    const ta = taRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px' }
  }, [input])

  /* ── Filtered chats ───────────────────────────────────────────────────── */
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase()
    return chats.filter((c) => c.title.toLowerCase().includes(q))
  }, [chats, searchQuery])

  /* ── Computed render values ────────────────────────────────────────────── */
  const modelOptions = useMemo(() => {
    const planType = user?.role === 'ADMIN' ? 'ADMIN' : (quota ? quota.planType : 'LOADING')
    return buildModelOptions(adminModels, aiKeys, planType)
  }, [adminModels, aiKeys, quota, user])

  const selectedOption = modelOptions.find((o) => o.value === model)
  const ModelIcon = selectedOption?.icon || Zap
  const selectedModelLabel = getModelLabel(model, adminModels, aiKeys)
  const empty = messages.length === 0 && !streamText

  /* ── Model change handler (for TopBar) ─────────────────────────────────── */
  const handleModelChange = useCallback((val) => {
    setModel(val)
    if (activeId && typeof val === 'string') {
      const { model: m, aiKeyId: k } = parseModelSelection(val)
      api.setChatModel(activeId, m, k).catch(() => {})
    }
  }, [activeId])

  /* ── Auth guard ────────────────────────────────────────────────────────── */
  if (!ready) {
    return <div className="container section" style={{ textAlign: 'center' }}><p className="text-muted">{t('common.loading')}</p></div>
  }
  if (!user) {
    return (
      <div className="container section" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: '40px 32px', maxWidth: 460, textAlign: 'center' }}>
          <MessageSquare size={30} style={{ marginBottom: 12 }} />
          <h2 className="display" style={{ fontSize: 24, marginBottom: 14 }}>Masuk untuk Mulai Chat</h2>
          <p className="text-muted" style={{ marginBottom: 20 }}>Login dengan Google untuk mengakses asisten AriseHash.</p>
          <Link to="/login" className="pill pill-indigo">{t('nav.login')}</Link>
        </div>
      </div>
    )
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className={`chat-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <ChatSidebar
        chats={chats}
        activeId={activeId}
        searchQuery={searchQuery}
        filteredChats={filteredChats}
        renamingChatId={renamingChatId}
        renameText={renameText}
        quota={quota}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        onOpenChat={openChat}
        onNewChat={newChat}
        onRemoveChat={removeChat}
        onDeleteAllChats={deleteAllChats}
        onStartRename={startRename}
        onCommitRename={commitRename}
        onSetSearchQuery={setSearchQuery}
        onSetRenamingChatId={setRenamingChatId}
        onSetRenameText={setRenameText}
        onSetSidebarOpen={setSidebarOpen}
        onSetSidebarCollapsed={setSidebarCollapsed}
      />

      <section className="chat-main" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Hidden file inputs — always mounted for both welcome + chat views */}
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} onChange={handleFileAttach} style={{ display: 'none' }} />
        <input ref={imageInputRef} type="file" multiple accept={ACCEPTED_IMAGE_TYPES} onChange={handleImageAttach} style={{ display: 'none' }} />

        <AnimatePresence mode="wait">
          {empty ? (
            <ChatWelcome
              key="welcome"
              user={user}
              input={input}
              model={model}
              modelOptions={modelOptions}
              streaming={streaming}
              deepSearch={deepSearch}
              attachedFiles={attachedFiles}
              attachedImages={attachedImages}
              uploading={uploading}
              showGithubInput={showGithubInput}
              githubUrl={githubUrl}
              analyzingGithub={analyzingGithub}
              onSetInput={setInput}
              onSetModel={setModel}
              onSetDeepSearch={setDeepSearch}
              onSend={send}
              onTriggerFilePicker={triggerFilePicker}
              onTriggerImagePicker={triggerImagePicker}
              onToggleGithubInput={toggleGithubInput}
              onSetGithubUrl={setGithubUrl}
              onSetShowGithubInput={setShowGithubInput}
              onHandleGithubAnalyze={handleGithubAnalyze}
              onRemoveFile={removeFile}
              onRemoveImage={removeImage}
              onKeyDown={onKeyDown}
            />
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
            >

              <ChatTopBar
                model={model}
                modelOptions={modelOptions}
                activeId={activeId}
                messages={messages}
                onSetModel={handleModelChange}
                onExportChat={exportChat}
                onSetSidebarOpen={setSidebarOpen}
                onSetSidebarCollapsed={setSidebarCollapsed}
              />

              <ChatThread
                messages={messages}
                streamText={streamText}
                streaming={streaming}
                scrollRef={scrollRef}
                showScrollBtn={showScrollBtn}
                editingMsgId={editingMsgId}
                editingText={editingText}
                user={user}
                adminModels={adminModels}
                aiKeys={aiKeys}
                model={model}
                activeId={activeId}
                onStartEdit={startEdit}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                onSetEditingText={setEditingText}
                onScroll={onScroll}
                onScrollToBottom={scrollToBottom}
                onSend={send}
                onRegenerate={regenerate}
                onBuildCode={buildCode}
              />

              <ChatComposer
                input={input}
                streaming={streaming}
                model={model}
                activeId={activeId}
                ModelIcon={ModelIcon}
                attachedFiles={attachedFiles}
                attachedImages={attachedImages}
                uploading={uploading}
                showGithubInput={showGithubInput}
                githubUrl={githubUrl}
                analyzingGithub={analyzingGithub}
                deepSearch={deepSearch}
                selectedModelLabel={selectedModelLabel}
                taRef={taRef}
                onSetInput={setInput}
                onSend={send}
                onStopStreaming={stopStreaming}
                onKeyDown={onKeyDown}
                onTriggerFilePicker={triggerFilePicker}
                onTriggerImagePicker={triggerImagePicker}
                onToggleGithubInput={toggleGithubInput}
                onSetGithubUrl={setGithubUrl}
                onSetShowGithubInput={setShowGithubInput}
                onHandleGithubAnalyze={handleGithubAnalyze}
                onRemoveFile={removeFile}
                onRemoveImage={removeImage}
                onSetDeepSearch={setDeepSearch}
                MAX_CHARS={MAX_CHARS}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
