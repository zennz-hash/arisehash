import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Save, Loader2, Terminal as TerminalIcon, Send, AlertTriangle,
  Eye, User as UserIcon, MessageSquare, Download, ExternalLink,
  FilePlus, History,
  Code2, RefreshCw, Maximize2, Minimize2, Monitor, ChevronDown, Share2, Users,
  Image as ImageIcon, X
} from 'lucide-react'
import { api, authHeaders } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { buildZip, downloadBlob } from '../utils/zip.js'
import { API_BASE } from '../config.js'
import { readSSEStream, SSEError } from '../utils/sse.js'
import FullscreenLoader from '../components/FullscreenLoader.jsx'
import { readAttachment } from '../utils/attachments.js'

import {
  SandpackProvider,
  SandpackPreview,
  SandpackConsole,
  SandpackCodeEditor,
  SandpackFileExplorer,
  useSandpack,
  useSandpackNavigation
} from '@codesandbox/sandpack-react'

// Safely read dependencies from a (possibly AI-mangled) package.json string.
// Returns {} on any parse failure instead of throwing during render.
function safeParseDeps(pkgJson) {
  try {
    return JSON.parse(pkgJson || '{}').dependencies || {}
  } catch {
    return {}
  }
}

function safeProjectPath(raw) {
  if (!raw) return null
  let path = String(raw).trim().replace(/\\/g, '/')
  if (!path.startsWith('/')) path = '/' + path
  path = path.replace(/\/{2,}/g, '/')
  if (path.split('/').some((segment) => segment === '..')) return null
  return path
}

// Captures Sandpack compile/runtime errors for the auto-fix loop.
function ErrorListener({ onCompileError }) {
  const { sandpack } = useSandpack()
  const errorRef = useRef(null)
  useEffect(() => {
    const error = sandpack.error
    if (error && error.message && error.message !== errorRef.current) {
      errorRef.current = error.message
      onCompileError(error.message)
    } else if (!error) {
      errorRef.current = null
    }
  }, [sandpack.error, onCompileError])
  return null
}

// Preview top toolbar: device pill, mock URL, refresh, fullscreen.
function PreviewToolbar({ full, onToggleFull }) {
  const { refresh } = useSandpackNavigation()
  return (
    <div className="ide-pv-bar">
      <span className="ide-pv-device" title="Tampilan"><Monitor size={14} /></span>
      <div className="ide-pv-url">
        <span className="ide-pv-dot" />
        localhost:3000<span className="ide-pv-path">/</span>
      </div>
      <button className="ide-pv-btn" onClick={refresh} title="Muat ulang" aria-label="Muat ulang"><RefreshCw size={14} /></button>
      <button className="ide-pv-btn" onClick={onToggleFull} title={full ? 'Keluar layar penuh' : 'Layar penuh'} aria-label="Layar penuh">
        {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const { theme } = useTheme()

  const { getCache, setCacheItem } = useWorkspace()
  const cached = getCache(id) || {}

  const [project, setProject] = useState(cached.project || null)
  const [files, setFiles] = useState(cached.files || {})
  const [messages, setMessages] = useState(cached.messages || [])
  const [loading, setLoading] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [quota, setQuota] = useState(cached.quota || null)
  const [rightTab, setRightTab] = useState('preview') // preview | code
  const [mobileView, setMobileView] = useState('chat') // chat | output (mobile only)
  const [autoCorrecting, setAutoCorrecting] = useState(false)
  const [showFiles, setShowFiles] = useState(true)
  const [activeFile, setActiveFile] = useState(cached.activeFile || '/App.js')
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [versionDiff, setVersionDiff] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareDays, setShareDays] = useState(30)
  const [shareAllowDownload, setShareAllowDownload] = useState(false)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [collaborators, setCollaborators] = useState([])
  const [collabEmail, setCollabEmail] = useState('')
  const [collabRole, setCollabRole] = useState('VIEWER')
  const [previewFull, setPreviewFull] = useState(false)
  const [streamingPath, setStreamingPath] = useState(null)
  const [aiKeyId, setAiKeyId] = useState(null)
  const [loaded, setLoaded] = useState(cached.loaded || false)
  const [attachments, setAttachments] = useState([])
  const [fileDialog, setFileDialog] = useState(null)
  const imageInputRef = useRef(null)

  const onPickImages = useCallback(async (e) => {
    const fileList = Array.from(e.target.files || [])
    e.target.value = ''
    const newAtts = []
    for (const f of fileList) {
      if (newAtts.length + attachments.length >= 4) {
        addToast('Maksimal 4 lampiran.', 'error')
        break
      }
      if (f.size > 4 * 1024 * 1024) {
        addToast(`${f.name} terlalu besar (maks 4MB).`, 'error')
        continue
      }
      try {
        const att = await readAttachment(f)
        newAtts.push(att)
      } catch (err) {
        addToast(err.message, 'error')
      }
    }
    if (newAtts.length) {
      setAttachments((prev) => [...prev, ...newAtts].slice(0, 4))
    }
  }, [addToast, attachments.length])

  const debounceTimerRef = useRef(null)
  const scrollRef = useRef(null)
  const autoRanRef = useRef(false)
  const autoFixAttemptsRef = useRef(0)
  const abortRef = useRef(null)
  const filesRef = useRef(files)
  const messagesRef = useRef(messages)

  useEffect(() => { filesRef.current = files }, [files])
  useEffect(() => { messagesRef.current = messages }, [messages])

  const loadWorkspace = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await api.getCodeProject(id)
      setProject(data)
      let loadedFiles = {}
      try { loadedFiles = JSON.parse(data.filesJson || '{}') } catch { loadedFiles = {} }
      setFiles(loadedFiles)
      // Pick a sensible entry file to show first (varies per stack).
      const keys = Object.keys(loadedFiles)
      const entry = keys.find((k) => /(\/src)?\/(App|index)\.(jsx?|tsx?|vue|svelte)$/.test(k))
        || keys.find((k) => k !== '/package.json' && !k.endsWith('.html') && !k.endsWith('.css'))
        || keys[0]
      if (entry) setActiveFile(entry)
      let loadedMessages = []
      try { loadedMessages = JSON.parse(data.messagesJson || '[]') } catch { loadedMessages = [] }
      setMessages(loadedMessages)
      const loadedQuota = await api.quota().catch(() => null)
      if (loadedQuota) setQuota(loadedQuota)

      // Write to cache
      setCacheItem(id, {
        project: data,
        files: loadedFiles,
        messages: loadedMessages,
        activeFile: entry || '/App.js',
        quota: loadedQuota,
        loaded: true
      })
    } catch (err) {
      if (!silent) addToast(err.message, 'error')
    } finally {
      if (!silent) setLoading(false)
      setLoaded(true)
    }
  }

  // Handle id mounting / page changes
  useEffect(() => {
    if (!id || !user) return
    const cachedItem = getCache(id)
    if (cachedItem) {
      setProject(cachedItem.project || null)
      setFiles(cachedItem.files || {})
      setMessages(cachedItem.messages || [])
      setQuota(cachedItem.quota || null)
      setActiveFile(cachedItem.activeFile || '/App.js')
      setLoaded(cachedItem.loaded || false)
      setLoading(false)
      // Load silently in background to keep fresh
      loadWorkspace(true)
    } else {
      // Clean states & load fresh
      setProject(null)
      setFiles({})
      setMessages([])
      setQuota(null)
      setActiveFile('/App.js')
      setLoaded(false)
      loadWorkspace(false)
    }
  }, [id, user])

  // Central cache sync useEffect
  useEffect(() => {
    if (!id || !loaded) return
    setCacheItem(id, {
      project,
      files,
      messages,
      activeFile,
      quota,
      loaded
    })
  }, [id, project, files, messages, activeFile, quota, loaded])

  useEffect(() => {
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
  }, [messages, loading])

  const saveWorkspace = async (cf = files, cm = messages, silent = false) => {
    try {
      await api.saveCodeProject(id, JSON.stringify(cf), JSON.stringify(cm), project?.name)
      if (!silent) addToast('Proyek tersimpan!', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const executeInstruction = useCallback(async (customPrompt = null, isAutoFix = false, atts = null, keyOverride = undefined) => {
    const promptToSend = customPrompt || instruction
    if (!promptToSend.trim()) return

    if (isAutoFix) {
      setAutoCorrecting(true)
      addToast('Galat terdeteksi — sedang diperbaiki...', 'info')
    } else {
      setLoading(true)
      setInstruction('')
      // A manual instruction resets the auto-fix budget for the next error.
      autoFixAttemptsRef.current = 0
    }

    const attsToSend = atts !== null ? atts : attachments
    const updatedMessages = [...messages, { role: 'user', content: promptToSend, ...(attsToSend.length ? { attachments: attsToSend } : {}) }]
    setMessages(updatedMessages)
    setAttachments([])

    // Cancel any previous in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      let activeSkills = ["frontend-design", "web-design-guidelines", "ui-ux-pro-max", "vercel-react-best-practices", "framer-motion-animations", "react-performance-optimizer"]
      let customSkills = []
      try {
        const stored = localStorage.getItem('arisehash_active_skills')
        if (stored) activeSkills = JSON.parse(stored)
        const storedCustom = localStorage.getItem('arisehash_custom_skills')
        if (storedCustom) customSkills = JSON.parse(storedCustom)
      } catch (e) {}

      const response = await fetch(`${API_BASE}/api/code-projects/${id}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders('POST') },
        body: JSON.stringify({
          instruction: promptToSend,
          messagesHistory: messagesRef.current,
          model: project?.mode || null,
          attachments: attsToSend.length ? attsToSend : undefined,
          aiKeyId: (keyOverride !== undefined ? keyOverride : aiKeyId) || undefined,
          activeSkills,
          customSkills
        }),
        credentials: 'include',
        signal: controller.signal
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        const detail = err.details ? Object.values(err.details).flat().join('; ') : ''
        throw new Error((err.error || 'Gagal mengirim instruksi') + (detail ? ': ' + detail : ''))
      }
      let fullCodeStream = ''
      const filesBeforeStream = { ...filesRef.current }
      let switchedToCode = false

      await readSSEStream(response, {
        onChunk: (chunk) => {
          fullCodeStream += chunk
          // Parse <vcFile> blocks from accumulated text for live preview
          const next = { ...filesRef.current }
          let lastPath = null
          const re = /<vcFile\s+path="([^"]+)">([\s\S]*?)(?:<\/vcFile>|$)/g
          let m
          while ((m = re.exec(fullCodeStream)) !== null) {
            const safePath = safeProjectPath(m[1])
            if (safePath) { next[safePath] = m[2]; lastPath = safePath }
          }
          if (lastPath) {
            setFiles(next)
            setActiveFile(lastPath)
            setStreamingPath(lastPath)
            if (!switchedToCode) { switchedToCode = true; setRightTab('code'); setMobileView('output') }
          }
        },
        onDone: async (parsed) => {
          setStreamingPath(null)
          const count = Number(parsed.filesUpdated || 0)
          let finalFiles = filesBeforeStream
          let updatedPaths = Array.isArray(parsed.updatedPaths) ? parsed.updatedPaths : []
          let finalFilesLoaded = false
          if (count > 0) {
            try {
              const fresh = await api.getCodeProject(id)
              finalFiles = JSON.parse(fresh.filesJson || '{}')
              setProject(fresh)
              finalFilesLoaded = true
            } catch (err) {
              addToast(`Perubahan tersimpan, tapi gagal memuat ulang file final: ${err.message}`, 'error')
              finalFiles = filesBeforeStream
            }
            if (updatedPaths.length === 0) updatedPaths = Object.keys(finalFiles)
            setFiles(finalFiles)
            const filesList = updatedPaths.map(p => `• ${p}`).join('\n')
            const assistantMsg = `Memperbarui ${count} berkas di workspace:\n${filesList}`
            const fm = [...updatedMessages, { role: 'assistant', content: assistantMsg }]
            setMessages(fm)
            if (finalFilesLoaded) {
              await saveWorkspace(finalFiles, fm, true)
            } else {
              await api.saveCodeProject(id, undefined, JSON.stringify(fm), project?.name)
            }
            setRightTab('preview')
            setMobileView('output')
          } else {
            const fm = [...updatedMessages, { role: 'assistant', content: 'Instruksi diproses, tidak ada perubahan berkas.' }]
            setMessages(fm)
            setFiles(filesBeforeStream)
            await saveWorkspace(filesBeforeStream, fm, true)
          }
          if (parsed.validationWarnings?.length) addToast(`Validasi: ${parsed.validationWarnings[0]}`, 'info')
          addToast(isAutoFix ? 'Kode diperbaiki!' : 'Perubahan diterapkan!', 'success')
          try { setQuota(await api.quota()) } catch { /* ignore */ }
        },
        signal: controller.signal
      })
    } catch (err) {
      if (err instanceof SSEError) {
        addToast(err.message, 'error')
      } else {
        addToast(err.message, 'error')
      }
    } finally {
      setLoading(false)
      setAutoCorrecting(false)
      setStreamingPath(null)
    }
  }, [instruction, messages, id, project, aiKeyId, attachments])

  // Auto-run the first instruction passed from the Build Code entry page.
  useEffect(() => {
    const initial = location.state?.initialPrompt
    if (!initial || autoRanRef.current) return
    if (!loaded || !project) return
    if (messages.length > 0) { autoRanRef.current = true; return }
    autoRanRef.current = true
    const atts = location.state?.attachments || null
    const navKey = location.state?.aiKeyId || null
    if (navKey) setAiKeyId(navKey)
    // Clear router state so a refresh doesn't re-trigger.
    navigate(`/app/ide/${id}`, { replace: true, state: {} })
    executeInstruction(initial, false, atts, navKey)
  }, [loaded, project, messages.length, location.state, id, navigate, executeInstruction])

  const MAX_AUTO_FIX_ATTEMPTS = 3
  const handleCompileError = useCallback((errorMessage) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (autoCorrecting || loading) return
      // Cap consecutive auto-fix attempts so a model that can't fix the error
      // doesn't loop forever, draining quota/tokens. Manual edits reset it.
      if (autoFixAttemptsRef.current >= MAX_AUTO_FIX_ATTEMPTS) {
        addToast('Perbaikan otomatis dihentikan setelah beberapa percobaan. Silakan perbaiki manual atau kirim instruksi baru.', 'error')
        return
      }
      autoFixAttemptsRef.current += 1
      executeInstruction(`Terjadi error kompilasi/runtime:\n"${errorMessage}"\nPerbaiki berkas yang bermasalah agar aplikasi berjalan lancar.`, true)
    }, 3000)
  }, [autoCorrecting, loading, executeInstruction, addToast])

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    abortRef.current?.abort()
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (busy || !instruction.trim()) return
      executeInstruction()
    }
  }

  // Download all project files as a ZIP (dependency-free).
  const downloadZip = useCallback(() => {
    try {
      const safe = (project?.name || 'project').replace(/\s+/g, '-').toLowerCase()
      const packaged = {
        ...files,
        '/README.md': `# ${project?.name || 'AriseHash Project'}\n\nPrototipe frontend ini diekspor dari AriseHash.\n\n## Jalankan\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nCatatan: project hasil export adalah prototipe frontend sesuai template Sandpack (${project?.template || 'react'}).\n`,
        '/.env.example': '# Tambahkan environment variable frontend di sini bila dibutuhkan.\n'
      }
      downloadBlob(buildZip(packaged), `${safe}.zip`)
      addToast('Proyek diunduh sebagai ZIP.', 'success')
    } catch (err) { addToast('Gagal membuat ZIP: ' + err.message, 'error') }
  }, [files, project, addToast])

  // Toggle public share link for this code project.
  const handleShareCode = useCallback(async () => {
    try {
      const makePublic = !project?.isPublic
      const r = await api.shareCodeProject(id, makePublic, { expiresInDays: Number(shareDays) || 30, allowDownload: shareAllowDownload })
      setProject((p) => ({ ...p, ...r }))
      if (r.isPublic && r.shareToken) {
        const url = `${window.location.origin}/share/code/${r.shareToken}`
        try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
        addToast('Link publik disalin ke clipboard!', 'success')
      } else {
        addToast('Berbagi dimatikan.', 'info')
      }
    } catch (err) { addToast(err.message, 'error') }
  }, [id, project, shareDays, shareAllowDownload, addToast])

  const toggleCollaborators = useCallback(async () => {
    const next = !showCollaborators
    setShowCollaborators(next)
    if (next) {
      try { setCollaborators(await api.codeCollaborators(id)) } catch (err) { addToast(err.message, 'error') }
    }
  }, [showCollaborators, id, addToast])

  const addCollaborator = useCallback(async () => {
    if (!collabEmail.trim()) return
    try {
      const row = await api.addCodeCollaborator(id, collabEmail.trim(), collabRole)
      setCollaborators((prev) => [row, ...prev.filter((c) => c.userId !== row.userId)])
      setCollabEmail('')
      if (row.emailStatus === 'skipped') {
        addToast('Kolaborator ditambahkan. (Email notifikasi dilewati karena SMTP tidak terkonfigurasi, bagikan link secara manual)', 'warning')
      } else if (row.emailStatus === 'failed') {
        addToast('Kolaborator ditambahkan. (Gagal mengirim email notifikasi, bagikan link secara manual)', 'warning')
      } else {
        addToast('Kolaborator ditambahkan.', 'success')
      }
    } catch (err) { addToast(err.message, 'error') }
  }, [id, collabEmail, collabRole, addToast])

  const removeCollaborator = useCallback(async (userId) => {
    try {
      await api.removeCodeCollaborator(id, userId)
      setCollaborators((prev) => prev.filter((c) => c.userId !== userId))
      addToast('Kolaborator dihapus.', 'success')
    } catch (err) { addToast(err.message, 'error') }
  }, [id, addToast])

  // Open the current files in an external editor (CodeSandbox via define API).
  const openExternal = useCallback((target) => {
    try {
      if (target === 'codesandbox') {
        const sandboxFiles = {}
        Object.entries(files).forEach(([path, code]) => {
          sandboxFiles[path.replace(/^\//, '')] = { content: code }
        })
        const params = btoa(unescape(encodeURIComponent(JSON.stringify({ files: sandboxFiles }))))
        const form = document.createElement('form')
        form.method = 'POST'; form.target = '_blank'
        form.action = 'https://codesandbox.io/api/v1/sandboxes/define'
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = 'parameters'; input.value = params
        form.appendChild(input); document.body.appendChild(form); form.submit(); form.remove()
      } else {
        // StackBlitz via POST form
        const form = document.createElement('form')
        form.method = 'POST'; form.target = '_blank'
        form.action = 'https://stackblitz.com/run'
        const add = (name, value) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = name; i.value = value; form.appendChild(i) }
        Object.entries(files).forEach(([path, code]) => add(`project[files][${path.replace(/^\//, '')}]`, code))
        add('project[title]', project?.name || 'AriseHash Project')
        add('project[description]', 'Dibuat dengan AriseHash')
        add('project[template]', 'create-react-app')
        document.body.appendChild(form); form.submit(); form.remove()
      }
    } catch (err) { addToast('Gagal membuka editor eksternal: ' + err.message, 'error') }
  }, [files, project, addToast])

  // File explorer: add a new file through an in-app dialog.
  const addFile = useCallback(() => {
    setFileDialog({ value: '/NewFile.jsx' })
  }, [])

  const submitFileDialog = useCallback((e) => {
    e.preventDefault()
    if (!fileDialog) return
    let name = fileDialog.value.trim()
    if (!name) { addToast('Nama berkas wajib diisi.', 'error'); return }
    if (!name.startsWith('/')) name = '/' + name

    if (files[name]) { addToast('Berkas sudah ada.', 'error'); return }
    const next = { ...files, [name]: '// ' + name + '\n' }
    setFiles(next); setActiveFile(name); saveWorkspace(next, messages, true)

    setFileDialog(null)
  }, [fileDialog, files, messages, addToast, saveWorkspace])

  const toggleVersions = useCallback(async () => {
    const next = !showVersions
    setShowVersions(next)
    if (next) {
      try { setVersions(await api.codeVersions(id)) } catch (err) { addToast(err.message, 'error') }
    }
  }, [showVersions, id, addToast])

  const snapshotNow = useCallback(async () => {
    try {
      await api.saveCodeProject(id, JSON.stringify(files), JSON.stringify(messages), project?.name)
      await api.saveCodeVersion(id)
      setVersions(await api.codeVersions(id))
      addToast('Snapshot tersimpan.', 'success')
    } catch (err) { addToast(err.message, 'error') }
  }, [id, files, messages, project, addToast])

  const restoreVersion = useCallback(async (versionId) => {
    const ok = await confirm({ title: 'Pulihkan versi ini?', message: 'File workspace akan diganti dengan snapshot ini.', confirmText: 'Pulihkan' })
    if (!ok) return
    try {
      const updated = await api.restoreCodeVersion(id, versionId)
      setFiles(JSON.parse(updated.filesJson))
      setShowVersions(false)
      addToast('Versi dipulihkan.', 'success')
    } catch (err) { addToast(err.message, 'error') }
  }, [id, confirm, addToast])

  const compareVersion = useCallback(async (versionId) => {
    try {
      const snap = await api.codeVersion(id, versionId)
      const oldFiles = JSON.parse(snap.filesJson || '{}')
      const currentKeys = new Set(Object.keys(files))
      const oldKeys = new Set(Object.keys(oldFiles))
      const added = [...currentKeys].filter((k) => !oldKeys.has(k))
      const removed = [...oldKeys].filter((k) => !currentKeys.has(k))
      const changed = [...currentKeys].filter((k) => oldKeys.has(k) && files[k] !== oldFiles[k])
      setVersionDiff({ label: snap.label, added, removed, changed })
    } catch (err) { addToast(err.message, 'error') }
  }, [id, files, addToast])

  if (!project || Object.keys(files).length === 0) {
    if (!loaded) {
      return <FullscreenLoader />
    }
    return (
      <div className="dash-page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: '40px 32px', maxWidth: 440, textAlign: 'center' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: 'var(--ink)', color: 'var(--on-ink)' }}><Code2 size={26} /></span>
          <h2 className="display" style={{ fontSize: 20, marginBottom: 8 }}>Workspace tidak ditemukan</h2>
          <p className="text-muted" style={{ fontSize: 14, marginBottom: 20 }}>Proyek kode ini mungkin sudah dihapus atau belum punya berkas.</p>
          <button onClick={() => navigate('/app/build-code')} className="pill pill-indigo">Kembali ke Bangun Kode</button>
        </div>
      </div>
    )
  }

  const busy = loading || autoCorrecting

  return (
    <div className="ide-shell">
      {/* Header */}
      <header className="ide-header">
        <div className="ide-head-l">
          <button onClick={() => navigate('/app/build-code')} className="ide-back" aria-label="Kembali ke awal">
            <ArrowLeft size={16} /> <span className="ide-back-label">Kembali ke awal</span>
          </button>
        </div>
        <h1 className="ide-head-title display">{project.name}</h1>
        <div className="ide-head-r">
          <button onClick={toggleVersions} className="ide-hbtn" title="Riwayat versi" aria-label="Riwayat versi">
            <History size={15} /> <span className="ide-hbtn-label">Versi</span>
          </button>
          <button onClick={() => setShowShare((v) => !v)} className="ide-hbtn" title="Pengaturan berbagi" aria-label="Pengaturan berbagi">
            <Share2 size={15} /> <span className="ide-hbtn-label">{project.isPublic ? 'Publik' : 'Bagikan'}</span>
          </button>
          <button onClick={toggleCollaborators} className="ide-hbtn" title="Kolaborator" aria-label="Kolaborator">
            <Users size={15} /> <span className="ide-hbtn-label">Kolab</span>
          </button>
          <button onClick={() => saveWorkspace()} className="ide-hbtn" title="Simpan" aria-label="Simpan">
            <Save size={15} /> <span className="ide-hbtn-label">Simpan</span>
          </button>
          <div className="ide-export-wrap">
            <button onClick={() => setShowExport((v) => !v)} className="pill ide-export-btn">
              <Download size={15} /> Ekspor <ChevronDown size={14} style={{ opacity: .7 }} />
            </button>
            {showExport && (
              <>
                <button type="button" className="ide-export-backdrop" onClick={() => setShowExport(false)} aria-label="Tutup menu ekspor" />
                <div className="ide-export-menu">
                  <button onClick={() => { downloadZip(); setShowExport(false) }}><Download size={15} /> Unduh ZIP</button>
                  <button onClick={() => { openExternal('stackblitz'); setShowExport(false) }}><ExternalLink size={15} /> Buka di StackBlitz</button>
                  <button onClick={() => { openExternal('codesandbox'); setShowExport(false) }}><ExternalLink size={15} /> Buka di CodeSandbox</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showVersions && (
        <div className="ide-versions">
          <div className="ide-versions-head">
            <span><History size={14} /> Riwayat Versi</span>
            <button className="ide-hbtn" onClick={snapshotNow}><FilePlus size={14} /> Simpan Snapshot</button>
          </div>
          {versions.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, padding: '8px 4px' }}>Belum ada snapshot. Snapshot otomatis dibuat sebelum kode diubah.</p>
          ) : (
            <ul className="ide-versions-list">
              {versions.map((v) => (
                <li key={v.id}>
                  <span className="ide-ver-label">{v.label}</span>
                  <span className="ide-ver-time">{new Date(v.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <button className="ide-hbtn" onClick={() => compareVersion(v.id)}>Bandingkan</button>
                  <button className="ide-hbtn" onClick={() => restoreVersion(v.id)}>Pulihkan</button>
                </li>
              ))}
            </ul>
          )}
          {versionDiff && (
            <div className="card" style={{ padding: 12, marginTop: 12, background: 'var(--surface-2)' }}>
              <strong style={{ fontSize: 13 }}>Diff: {versionDiff.label}</strong>
              <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Berubah {versionDiff.changed.length} · Ditambah {versionDiff.added.length} · Dihapus {versionDiff.removed.length}
              </p>
              <div className="text-muted" style={{ fontSize: 11.5, marginTop: 6, wordBreak: 'break-all' }}>
                {[...versionDiff.changed, ...versionDiff.added, ...versionDiff.removed].slice(0, 8).join(', ') || 'Tidak ada perbedaan.'}
              </div>
            </div>
          )}
        </div>
      )}

      {showShare && (
        <div className="ide-versions">
          <div className="ide-versions-head">
            <span><Share2 size={14} /> Berbagi Publik</span>
            <button className="ide-hbtn" onClick={handleShareCode}>{project.isPublic ? 'Matikan' : 'Aktifkan & Salin Link'}</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="text-muted" style={{ fontSize: 12 }}>Kadaluarsa
              <input className="input" name="shareDays" aria-label="Masa berlaku link berbagi dalam hari" style={{ width: 90, height: 34, marginLeft: 8 }} type="number" min="1" max="365" value={shareDays} onChange={(e) => setShareDays(e.target.value)} />
            </label>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" name="shareAllowDownload" checked={shareAllowDownload} onChange={(e) => setShareAllowDownload(e.target.checked)} /> Izinkan download ZIP publik
            </label>
            {project.shareViewCount != null && <span className="chip" style={{ fontSize: 10 }}>{project.shareViewCount} view</span>}
          </div>
        </div>
      )}

      {showCollaborators && (
        <div className="ide-versions">
          <div className="ide-versions-head"><span><Users size={14} /> Kolaborator</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input className="input" name="collaboratorEmail" type="email" autoComplete="email" spellCheck={false} aria-label="Email kolaborator" style={{ maxWidth: 260, height: 36 }} placeholder="email user terdaftar" value={collabEmail} onChange={(e) => setCollabEmail(e.target.value)} />
            <select className="input" name="collaboratorRole" aria-label="Peran kolaborator" style={{ maxWidth: 120, height: 36 }} value={collabRole} onChange={(e) => setCollabRole(e.target.value)}>
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
            <button className="ide-hbtn" onClick={addCollaborator}>Tambah</button>
          </div>
          {collaborators.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Belum ada kolaborator.</p>
          ) : (
            <ul className="ide-versions-list">
              {collaborators.map((c) => (
                <li key={c.id}>
                  <span className="ide-ver-label">{c.user?.name || c.user?.email}</span>
                  <span className="ide-ver-time">{c.role}</span>
                  <button className="ide-hbtn" onClick={() => removeCollaborator(c.userId)}>Hapus</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Mobile segmented control (chat ⇄ hasil) */}
      <div className="ide-mobile-switch">
        <button className={mobileView === 'chat' ? 'is-active' : ''} onClick={() => setMobileView('chat')}>
          <MessageSquare size={15} /> Obrolan
        </button>
        <button className={mobileView === 'output' ? 'is-active' : ''} onClick={() => setMobileView('output')}>
          <Eye size={15} /> Hasil
        </button>
      </div>

      <SandpackProvider
        className="ide-provider"
        files={files}
        template={project.template || 'react'}
        theme={theme === 'dark' ? 'dark' : 'light'}
        customSetup={{ dependencies: safeParseDeps(files['/package.json']) }}
        options={{ activeFile: activeFile, visibleFiles: Object.keys(files) }}
      >
        <div className={`ide-body mobile-${mobileView}`}>
          {/* Left: chat */}
          <aside className="ide-chat">
            <div className="ide-chat-head">
              <Code2 size={15} /> Asisten Kode
              {quota && <span className="ide-chat-quota">{quota.codeQuotaUsedToday} terpakai</span>}
            </div>
            <div className="ide-chat-scroll" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="ide-chat-empty">
                  <Code2 size={24} style={{ marginBottom: 8, color: 'var(--muted)' }} />
                  <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>Ketik perubahan yang kamu mau, misalnya "ubah warna tombol jadi hitam" atau "tambahkan halaman login".</p>
                </div>
              ) : messages.map((m, i) => (
                <div key={i} className={`ide-msg ide-msg-${m.role}`}>
                  <span className={`ide-msg-av ide-msg-av-${m.role}`}>
                    {m.role === 'user' ? <UserIcon size={13} /> : <Code2 size={13} />}
                  </span>
                  <div className="ide-msg-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    {m.role === 'user' && m.attachments && m.attachments.length > 0 && (
                      <div className="ide-msg-attachments" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {m.attachments.map((att, j) => (
                          <div key={j} className="ide-msg-att-img" style={{ position: 'relative', border: '1px solid var(--line-soft)', borderRadius: 8, overflow: 'hidden', width: 64, height: 64 }}>
                            <img src={att.dataUrl} alt={att.name} width="64" height="64" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="ide-msg ide-msg-assistant">
                  <span className="ide-msg-av ide-msg-av-assistant"><Code2 size={13} /></span>
                  <div className="ide-msg-body" style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)' }}>
                    {autoCorrecting ? <AlertTriangle size={13} /> : <Loader2 size={13} className="aster-spin" />}
                    {autoCorrecting
                      ? 'Memperbaiki galat...'
                      : streamingPath
                        ? <>Menulis <code className="ide-stream-path">{streamingPath}</code></>
                        : 'Menulis kode...'}
                  </div>
                </div>
              )}
            </div>
            <div className="ide-composer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {attachments.length > 0 && (
                <div className="bolt-attach-row" style={{ padding: '0 0 8px 0', borderBottom: '1px solid var(--line-soft)', marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                  {attachments.map((a, i) => (
                    <span key={i} className="bolt-attach-chip" style={{ position: 'relative' }}>
                      {a.type === 'image' && <img src={a.dataUrl} alt={a.name} width="22" height="22" className="bolt-attach-thumb" />}
                      <span className="bolt-attach-name">{a.name}</span>
                      <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} aria-label="Hapus lampiran" style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%' }}>
                <button
                  type="button"
                  className="composer-tool-btn"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={busy}
                  title="Unggah Foto"
                  aria-label="Unggah foto"
                  style={{ flexShrink: 0 }}
                >
                  <ImageIcon size={15} />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  name="instructionImages"
                  multiple
                  accept="image/*"
                  onChange={onPickImages}
                  hidden
                />
                <textarea
                  className="ide-composer-input"
                  placeholder="Ketik instruksi..."
                  aria-label="Instruksi perubahan kode"
                  name="codeInstruction"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={busy}
                  rows={2}
                />
                <button
                  className="ide-composer-send"
                  onClick={() => executeInstruction()}
                  disabled={busy || (!instruction.trim() && attachments.length === 0)}
                  aria-label="Kirim"
                  style={{ flexShrink: 0 }}
                >
                  {busy ? <Loader2 size={16} className="aster-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </aside>

          {/* Right: preview / code */}
          <section className={`ide-right ${previewFull ? 'is-full' : ''}`}>
            <div className="ide-tabs">
              <div className="ide-tabs-group">
                <button className={`ide-tab ${rightTab === 'preview' ? 'is-active' : ''}`} onClick={() => setRightTab('preview')}>
                  <Eye size={15} /> Pratinjau
                </button>
                <button className={`ide-tab ${rightTab === 'code' ? 'is-active' : ''}`} onClick={() => setRightTab('code')}>
                  <Code2 size={15} /> Kode
                  {streamingPath && <span className="ide-tab-live" title="Menulis kode" />}
                </button>
              </div>
              {rightTab === 'preview' && <PreviewToolbar full={previewFull} onToggleFull={() => setPreviewFull((v) => !v)} />}
              {rightTab === 'code' && (
                <button className="ide-code-add" onClick={addFile} title="Berkas baru" aria-label="Berkas baru">
                  <FilePlus size={15} />
                </button>
              )}
            </div>

            <div className="ide-right-body">
              {/* Preview */}
              <div className="ide-pane" style={{ display: rightTab === 'preview' ? 'block' : 'none' }}>
                {busy ? (
                  <div className="ide-gen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px', background: 'var(--bg)' }}>
                    <div className="gen-orb" style={{ width: 60, height: 60, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--fill)', color: 'var(--on-fill)', marginBottom: 20 }}>
                      <Loader2 size={24} className="aster-spin" />
                    </div>
                    <h2 className="display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                      {streamingPath ? 'Menulis Berkas Kode...' : 'Menyusun Aplikasi...'}
                    </h2>
                    <p className="text-muted" style={{ fontSize: 13, maxWidth: 360, margin: '0 auto 24px', lineHeight: 1.5 }}>
                      {streamingPath ? (
                        <>Sedang menulis perubahan pada berkas <code className="ide-stream-path" style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: -2 }}>{streamingPath}</code></>
                      ) : (
                        'Menghubungkan ke asisten kode untuk menerapkan perubahan...'
                      )}
                    </p>
                    <div className="gen-skeleton" style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8, margin: '0 auto' }}>
                      <span style={{ width: '90%' }} />
                      <span style={{ width: '70%', margin: '0 auto' }} />
                      <span style={{ width: '85%', margin: '0 auto' }} />
                    </div>
                  </div>
                ) : (
                  <SandpackPreview showNavigator={false} showRefreshButton={false} showOpenInCodeSandbox={false} style={{ height: '100%' }} />
                )}
              </div>

              {/* Code: explorer + editor with file tabs */}
              <div className="ide-pane ide-code-pane" style={{ display: rightTab === 'code' ? 'flex' : 'none' }}>
                <div className="ide-explorer">
                  <SandpackFileExplorer autoHiddenFiles={false} />
                </div>
                <div className="ide-editor">
                  <SandpackCodeEditor showTabs showLineNumbers showInlineErrors closableTabs style={{ height: '100%' }} />
                  <div className="ide-console">
                    <SandpackConsole />
                  </div>
                </div>
              </div>
            </div>
            <ErrorListener onCompileError={handleCompileError} />
          </section>
        </div>
      </SandpackProvider>

      {fileDialog && (
        <div className="modal-backdrop" style={{ zIndex: 100000, position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.55)', padding: 18 }}>
          <button type="button" onClick={() => setFileDialog(null)} aria-label="Tutup dialog berkas" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'default' }} />
          <form
            onSubmit={submitFileDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-dialog-title"
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: 22, position: 'relative', zIndex: 1 }}
          >
            <h2 id="file-dialog-title" className="display" style={{ fontSize: 18, marginBottom: 14 }}>
              Berkas Baru
            </h2>
            <label className="settings-label" htmlFor="ide-file-name">Nama berkas</label>
            <input
              id="ide-file-name"
              name="fileName"
              className="input"
              autoComplete="off"
              value={fileDialog.value}
              onChange={(e) => setFileDialog((d) => ({ ...d, value: e.target.value }))}
              placeholder="/components/Button.jsx"
              autoFocus
              required
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 }}>
              <button type="button" className="pill" onClick={() => setFileDialog(null)}>Batal</button>
              <button type="submit" className="pill pill-indigo">Tambah</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
