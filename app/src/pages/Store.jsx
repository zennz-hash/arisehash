import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { motion } from 'framer-motion'
import {
  Search, FileText, ArrowLeft, ArrowUpRight, Copy, Check, Edit2, Share2,
  History, Code, Loader2, CornerDownLeft, Layers, Download, Wand2,
  FolderInput, Tag, Trash2, Zap, Brain, Database, Server, Cloud, Eye, FileText as FileMd,
  ChevronLeft, ChevronRight, ArrowRight, Wrench, Bot, FileDown, Image as ImageIcon, CopyPlus, Folder, X,
  GitBranch
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import Dropdown from '../components/Dropdown.jsx'

import { SkeletonGrid } from '../components/Skeleton.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { api, authHeaders } from '../api.js'
import { parseModelSelection, buildModelOptions } from '../model-utils.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { API_BASE } from '../config.js'
import { readSSEStream, SSEError } from '../utils/sse.js'
import MermaidRender from '../components/MermaidRender.jsx'
import { renderInline } from '../utils/markdown.jsx'
import { useAdminModels } from '../utils/useAdminModels.js'
import ComposerToolbar from '../components/ComposerToolbar.jsx'
import { useFileAttachments } from '../utils/useFileAttachments.js'
import { useGithubAnalyzer } from '../utils/useGithubAnalyzer.js'

import {
  TEMPLATE_OPTIONS,
  FRONTEND_OPTIONS,
  BACKEND_OPTIONS,
  DATABASE_OPTIONS,
  DEPLOY_OPTIONS,
  SUGGESTIONS_STORE,
} from '../constants.js'

const Markdown = memo(function Markdown({ content }) {
  const blocks = useMemo(() => {
    const out = []
    const re = /```(\w+)?\n?([\s\S]*?)```/g
    let last = 0, m
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) out.push({ t: 'md', v: content.slice(last, m.index) })
      if ((m[1] || '').toLowerCase() === 'mermaid') out.push({ t: 'mermaid', v: m[2].trim() })
      else out.push({ t: 'code', lang: m[1] || '', v: m[2].replace(/\n$/, '') })
      last = m.index + m[0].length
    }
    if (last < content.length) out.push({ t: 'md', v: content.slice(last) })
    return out
  }, [content])

  return (
    <div className="prd-md">
      {blocks.map((b, bi) => {
        if (b.t === 'mermaid') return <div key={bi} className="prd-diagram"><MermaidRender chart={b.v} /></div>
        if (b.t === 'code') return <pre key={bi} className="prd-code"><code>{b.v}</code></pre>
        const lines = b.v.split('\n')
        const els = []
        let list = null
        const flush = (i) => { if (list) { els.push(<ul key={`u${bi}-${i}`} className="prd-ul">{list}</ul>); list = null } }
        lines.forEach((raw, i) => {
          const line = raw.replace(/\s+$/, '')
          if (!line.trim()) { flush(i); return }
          const h = /^(#{1,4})\s+(.*)$/.exec(line)
          if (h) {
            flush(i)
            const L = Math.min(h[1].length + 1, 5); const Tag = `h${L}`
            const headingText = h[2]
            // Section = from this heading until the next heading in full content.
            const copySection = () => {
              const idx = content.indexOf(line)
              if (idx < 0) { navigator.clipboard?.writeText(headingText); return }
              const after = content.slice(idx + line.length)
              const nextH = after.search(/\n#{1,4}\s/)
              const section = line + (nextH >= 0 ? after.slice(0, nextH) : after)
              navigator.clipboard?.writeText(section.trim())
            }
            els.push(
              <Tag key={`h${bi}-${i}`} className={`prd-h prd-h${h[1].length} prd-h-row`}>
                <span>{renderInline(headingText, `h${bi}${i}`, 'prd-')}</span>
                <button className="prd-h-copy" onClick={copySection} title="Salin bagian ini" aria-label="Salin bagian ini"><Copy size={13} /></button>
              </Tag>
            )
            return
          }
          const li = /^\s*[-*]\s+(.*)$/.exec(line) || /^\s*\d+\.\s+(.*)$/.exec(line)
          if (li) { if (!list) list = []; list.push(<li key={`l${bi}-${i}`}>{renderInline(li[1], `l${bi}${i}`, 'prd-')}</li>); return }
          flush(i); els.push(<p key={`p${bi}-${i}`} className="prd-p">{renderInline(line.trim(), `p${bi}${i}`, 'prd-')}</p>)
        })
        flush('end')
        return <div key={bi}>{els}</div>
      })}
    </div>
  )
})

const HistoryCard = memo(function HistoryCard({ bp, onOpen, onDelete, onDuplicate }) {
  let tg = []; try { tg = JSON.parse(bp.tagsJson || '[]') } catch { /* */ }
  return (
    <BorderGlowCard glowRadius={24} borderRadius={24} innerClassName="hist-card" style={{ height: '100%' }} innerStyle={{ borderRadius: 24, height: '100%' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
          <span className="chip chip-lime" style={{ fontSize: 9.5 }}>{bp.type}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {bp.folder && <span className="chip" style={{ fontSize: 9 }}>{bp.folder}</span>}
            <span className="text-muted" style={{ fontSize: 10.5 }}>v{bp.currentVersion}</span>
          </div>
        </div>
        <h3 className="display" style={{ fontSize: 15, marginBottom: 6 }}>{bp.name}</h3>
        <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>{(bp.content || '').slice(0, 80)}…</p>
        {tg.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
            {tg.slice(0, 3).map((t) => <span key={t} className="chip" style={{ fontSize: 9 }}>{t}</span>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="dash-hist-del" onClick={(e) => onDelete(bp.id, e)} title="Hapus" aria-label="Hapus proyek"><Trash2 size={14} /></button>
          {onDuplicate && <button className="dash-hist-del" onClick={(e) => onDuplicate(bp.id, e)} title="Duplikat" aria-label="Duplikat proyek"><CopyPlus size={14} /></button>}
        </div>
        <button onClick={() => onOpen(bp.id)} className="pill" style={{ padding: '6px 13px', fontSize: 12.5 }}>Buka <ArrowUpRight size={13} /></button>
      </div>
    </BorderGlowCard>
  )
})

const GEN_STEPS = [
  { icon: Brain, label: 'Menganalisis ide & konteks' },
  { icon: Layers, label: 'Menyusun arsitektur sistem' },
  { icon: Database, label: 'Merancang skema database' },
  { icon: Code, label: 'Menulis rencana implementasi' },
  { icon: Loader2, label: 'Menyempurnakan dokumen' },
]

const GeneratingView = memo(function GeneratingView({ stream, scrollRef }) {
  const [step, setStep] = useState(0)
  const [showStream, setShowStream] = useState(false)

  // Advance the visual step every ~2.6s (decorative, caps at last step).
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, GEN_STEPS.length - 1)), 2600)
    return () => clearInterval(t)
  }, [])

  // Approximate word count from streamed content (cheap, no re-render storm).
  const words = useMemo(() => (stream ? stream.trim().split(/\s+/).filter(Boolean).length : 0), [stream])

  return (
    <div className="bolt-page">
      <div className="gen-wrap">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="gen-card">
          {/* animated orb */}
          <div className="gen-orb">
            <span className="gen-orb-ring" />
            <span className="gen-orb-ring gen-orb-ring-2" />
            <Loader2 size={26} className="aster-spin" />
          </div>

          <h2 className="display gen-title">Menyusun rencana proyekmu</h2>
          <p className="gen-sub">Rencana proyek (PRD) sedang disusun. Biasanya butuh beberapa puluh detik.</p>

          {/* step checklist */}
          <div className="gen-steps">
            {GEN_STEPS.map((s, i) => {
              const state = i < step ? 'done' : i === step ? 'active' : 'idle'
              return (
                <div key={i} className={`gen-step gen-step-${state}`}>
                  <span className="gen-step-ic">
                    {state === 'done' ? <Check size={14} strokeWidth={3} /> : <s.icon size={15} />}
                  </span>
                  <span className="gen-step-label">{s.label}</span>
                  {state === 'active' && <span className="gen-step-dots"><i /><i /><i /></span>}
                </div>
              )
            })}
          </div>

          {/* shimmer skeleton lines */}
          <div className="gen-skeleton" aria-hidden="true">
            <span style={{ width: '90%' }} />
            <span style={{ width: '72%' }} />
            <span style={{ width: '84%' }} />
            <span style={{ width: '60%' }} />
          </div>

          <div className="gen-meta">
            <span className="gen-live-dot" /> {words > 0 ? `${words} kata ditulis` : 'Menghubungkan ke AI…'}
            <button className="gen-toggle" onClick={() => setShowStream((v) => !v)}>
              {showStream ? 'Sembunyikan' : 'Lihat'} aliran teks
            </button>
          </div>

          {showStream && (
            <div className="gen-stream" ref={scrollRef}>{stream || 'Menunggu respons server…'}</div>
          )}
        </motion.div>
      </div>
    </div>
  )
})


export default function Store() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()

  const [blueprints, setBlueprints] = useState([])
  const [wsLoading, setWsLoading] = useState(true)
  const [activeBlueprint, setActiveBlueprint] = useState(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const [activeFolder, setActiveFolder] = useState(() => new URLSearchParams(location.search).get('folder') || 'all')
  const [activeTag, setActiveTag] = useState(() => new URLSearchParams(location.search).get('tag') || null)

  const [phase, setPhase] = useState('composer') // composer | quiz | generating
  const [idea, setIdea] = useState('')
  const [projectName, setProjectName] = useState('')
  const [template, setTemplate] = useState('saas')
  const [techMode, setTechMode] = useState('auto') // auto | manual
  const [frontend, setFrontend] = useState('Auto')
  const [backend, setBackend] = useState('Auto')
  const [database, setDatabase] = useState('Auto')
  const [deploy, setDeploy] = useState('Auto')
  const [model, setModel] = useState(null)
  const { adminModels, aiKeys } = useAdminModels(user)
  const [quota, setQuota] = useState(null)

  const {
    fileInputRef,
    imageInputRef,
    attachments,
    setAttachments,
    triggerFilePicker,
    triggerImagePicker,
    onPickFiles,
  } = useFileAttachments(addToast)

  const {
    githubUrl,
    setGithubUrl,
    showGithubInput,
    setShowGithubInput,
    analyzingGithub,
    handleGithubAnalyze,
  } = useGithubAnalyzer(setAttachments, addToast)

  useEffect(() => { if (user) api.quota().then(setQuota).catch(() => {}) }, [user])
  // Auto-select first model when models load and none selected
  useEffect(() => {
    if (adminModels.length && model === null) setModel(adminModels[0].id)
  }, [adminModels, model])

  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [quizStep, setQuizStep] = useState(0)
  const [streamedPRD, setStreamedPRD] = useState('')

  const [viewMode, setViewMode] = useState('render')
  const [isEditing, setIsEditing] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [editorName, setEditorName] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [folder, setFolder] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [reviseText, setReviseText] = useState('')
  const [revising, setRevising] = useState(false)
  const [reviseStream, setReviseStream] = useState('')
  const genScrollRef = useRef(null)

  const fetchWorkspace = useCallback(async () => {
    if (!user) return
    try { const res = await api.blueprints(); setBlueprints(res?.items || res || []) } catch (err) { addToast(err.message, 'error') } finally { setWsLoading(false) }
  }, [user, addToast])
  useEffect(() => { fetchWorkspace() }, [fetchWorkspace])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const nextQuery = params.get('q') || ''
    const nextFolder = params.get('folder') || 'all'
    const nextTag = params.get('tag') || null
    if (query !== nextQuery) setQuery(nextQuery)
    if (activeFolder !== nextFolder) setActiveFolder(nextFolder)
    if (activeTag !== nextTag) setActiveTag(nextTag)
  }, [location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = query.trim()
    if (q) params.set('q', q)
    else params.delete('q')
    if (activeFolder && activeFolder !== 'all') params.set('folder', activeFolder)
    else params.delete('folder')
    if (activeTag) params.set('tag', activeTag)
    else params.delete('tag')
    const nextSearch = params.toString()
    const currentSearch = location.search.replace(/^\?/, '')
    if (nextSearch !== currentSearch) {
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true, state: location.state })
    }
  }, [query, activeFolder, activeTag, location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    const tpl = location.state?.template
    if (tpl) {
      if (tpl.template) setTemplate(tpl.template)
      if (tpl.idea) setIdea(tpl.idea)
      if (tpl.name) setProjectName(tpl.name)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  useEffect(() => {
    if (phase === 'generating' && genScrollRef.current) {
      genScrollRef.current.scrollTop = genScrollRef.current.scrollHeight
    }
  }, [streamedPRD, phase])

  const allFolders = useMemo(() => {
    const set = new Set()
    blueprints.forEach((bp) => { if (bp.folder) set.add(bp.folder) })
    return [...set].sort()
  }, [blueprints])

  const allTags = useMemo(() => {
    const set = new Set()
    blueprints.forEach((bp) => { try { JSON.parse(bp.tagsJson || '[]').forEach((t) => set.add(t)) } catch { /* */ } })
    return [...set].sort()
  }, [blueprints])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return blueprints.filter((bp) => {
      let tags = []
      try { tags = JSON.parse(bp.tagsJson || '[]') } catch { /* */ }
      if (activeFolder !== 'all' && bp.folder !== activeFolder) return false
      if (activeTag && !tags.includes(activeTag)) return false
      if (!q) return true
      return bp.name.toLowerCase().includes(q) || (bp.folder || '').toLowerCase().includes(q) || tags.join(' ').toLowerCase().includes(q)
    })
  }, [blueprints, query, activeFolder, activeTag])

  const selectBlueprint = useCallback(async (id) => {
    try {
      setLoading(true)
      const bp = await api.getBlueprint(id)
      setActiveBlueprint(bp)
      setEditorContent(bp.content); setEditorName(bp.name)
      setFolder(bp.folder || '')
      try { setTagsInput((JSON.parse(bp.tagsJson || '[]') || []).join(', ')) } catch { setTagsInput('') }
      setIsEditing(false); setViewMode('render'); setReviseText('')
    } catch (err) { addToast(err.message, 'error') } finally { setLoading(false) }
  }, [addToast])

  useEffect(() => {
    const openBlueprintId = location.state?.openBlueprintId
    if (!openBlueprintId || !user) return
    selectBlueprint(openBlueprintId)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.pathname, location.search, location.state, navigate, selectBlueprint, user])

  const startQuiz = useCallback(async () => {
    if (loading) return
    if (!idea.trim()) { addToast('Tuliskan dulu ide aplikasimu.', 'error'); return }
    setLoading(true)
    try {
      const { model: m, aiKeyId: k } = parseModelSelection(model)
      
      // Append attachments content to idea for context
      let promptWithContext = idea.trim()
      if (attachments && attachments.length > 0) {
        promptWithContext += '\n\n---\n**Lampiran Referensi:**\n'
        attachments.forEach(att => {
          if (att.type === 'text') {
            promptWithContext += `\n### File: ${att.name}\n\`\`\`\n${att.content}\n\`\`\`\n`
          } else if (att.type === 'image') {
            promptWithContext += `\n[Gambar Terlampir: ${att.name}]\n`
          }
        })
      }

      const qs = await api.generateQuestions(promptWithContext, template, m, k)
      const list = (Array.isArray(qs) ? qs : []).slice(0, 5)
      if (list.length === 0) {
        throw new Error('AI tidak mengembalikan pertanyaan. Coba lagi.')
      }
      const init = {}
      list.forEach((q) => { init[q.id] = q.options?.[0] })
      setQuestions(list); setAnswers(init); setQuizStep(0); setPhase('quiz')
    } catch (err) { addToast(err.message, 'error') } finally { setLoading(false) }
  }, [idea, template, model, attachments, loading, addToast])

  const generate = useCallback(async () => {
    setPhase('generating'); setStreamedPRD('')
    const clean = (v) => (v === 'Auto' ? '' : v)
    const answersList = questions.map((q) => ({ question: q.question, answer: answers[q.id] }))
    const { model: selectedModel, aiKeyId: selectedAiKeyId } = parseModelSelection(model)
    
    // Append attachments content to idea for context
    let promptWithContext = idea.trim()
    if (attachments && attachments.length > 0) {
      promptWithContext += '\n\n---\n**Lampiran Referensi:**\n'
      attachments.forEach(att => {
        if (att.type === 'text') {
          promptWithContext += `\n### File: ${att.name}\n\`\`\`\n${att.content}\n\`\`\`\n`
        } else if (att.type === 'image') {
          promptWithContext += `\n[Gambar Terlampir: ${att.name}]\n`
        }
      })
    }

    const body = {
      idea: promptWithContext, template,
      model: selectedModel,
      aiKeyId: selectedAiKeyId || undefined,
      quizAnswers: answersList, techMode,
      name: projectName.trim() || idea.slice(0, 40),
    }
    if (techMode === 'manual') {
      body.frontend = clean(frontend); body.backend = clean(backend)
      body.database = clean(database); body.deploy = clean(deploy)
    }
    try {
      const res = await fetch(`${API_BASE}/api/blueprints/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders('POST') },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal memulai') }
      if (!res.body) throw new Error('Respons streaming tidak tersedia')

      await readSSEStream(res, {
        onChunk: (chunk) => setStreamedPRD((prev) => prev + chunk),
        onDone: async (parsed) => {
          if (parsed.validationWarnings?.length) addToast(`Validasi: ${parsed.validationWarnings[0]}`, 'info')
          addToast('Proyek selesai dibuat!', 'success')
          setIdea(''); setProjectName(''); setQuestions([]); setAnswers({}); setAttachments([])
          await fetchWorkspace()
          await selectBlueprint(parsed.blueprintId)
          setPhase('composer')
        }
      })
    } catch (err) {
      if (err instanceof SSEError) {
        addToast(err.message, 'error')
      } else {
        addToast(err.message, 'error')
      }
      setPhase('quiz')
    }
  }, [idea, template, model, techMode, projectName, frontend, backend, database, deploy, questions, answers, attachments, addToast, fetchWorkspace, selectBlueprint, SSEError])

  const handleUpdate = useCallback(async () => {
    if (!activeBlueprint) return
    try {
      setLoading(true)
      const u = await api.updateBlueprint(activeBlueprint.id, editorContent, editorName)
      addToast('PRD diperbarui.', 'success')
      await selectBlueprint(u.id); await fetchWorkspace(); setIsEditing(false)
    } catch (err) { addToast(err.message, 'error') } finally { setLoading(false) }
  }, [activeBlueprint, editorContent, editorName, addToast, selectBlueprint, fetchWorkspace])

  const saveMeta = useCallback(async () => {
    if (!activeBlueprint) return
    try {
      const tags = tagsInput.split(',').map((s) => s.trim()).filter(Boolean)
      const u = await api.updateBlueprintMeta(activeBlueprint.id, { folder, tags })
      setActiveBlueprint((p) => ({ ...p, folder: u.folder, tagsJson: u.tagsJson }))
      addToast('Metadata disimpan.', 'success'); fetchWorkspace()
    } catch (err) { addToast(err.message, 'error') }
  }, [activeBlueprint, tagsInput, folder, addToast, fetchWorkspace])

  const doRevise = useCallback(async () => {
    if (!activeBlueprint || !reviseText.trim()) return
    setRevising(true)
    setReviseStream('')
    const { model: m2, aiKeyId: k2 } = parseModelSelection(model)
    try {
      const res = await fetch(`${API_BASE}/api/blueprints/${activeBlueprint.id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders('POST') },
        body: JSON.stringify({ instruction: reviseText, model: m2, aiKeyId: k2 }),
        credentials: 'include',
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Gagal merevisi') }
      if (!res.body) throw new Error('Respons streaming tidak tersedia')

      await readSSEStream(res, {
        onChunk: (chunk) => setReviseStream((prev) => prev + chunk),
        onDone: async (parsed) => {
          if (parsed.validationWarnings?.length) addToast(`Validasi: ${parsed.validationWarnings[0]}`, 'info')
          addToast('PRD direvisi AI.', 'success')
          setReviseText('')
          setReviseStream('')
          await selectBlueprint(activeBlueprint.id)
        }
      })
    } catch (err) {
      if (err instanceof SSEError) {
        addToast(err.message, 'error')
      } else {
        addToast(err.message, 'error')
      }
    } finally { setRevising(false); setReviseStream('') }
  }, [activeBlueprint, reviseText, model, addToast, selectBlueprint])

  const copyDoc = useCallback(() => {
    navigator.clipboard?.writeText(activeBlueprint?.content || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600); addToast('PRD disalin.', 'success')
    })
  }, [activeBlueprint, addToast])
  const exportMd = useCallback(() => {
    const blob = new Blob([activeBlueprint?.content || ''], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `${(activeBlueprint?.name || 'prd').replace(/\s+/g, '-').toLowerCase()}.md`; a.click(); URL.revokeObjectURL(url)
  }, [activeBlueprint])

  // Export PDF via the browser print dialog (Save as PDF).
  const exportPdf = useCallback(() => {
    const el = document.querySelector('.prd-md') || document.querySelector('.prd-scroll')
    if (!el) { window.print(); return }
    const w = window.open('', '_blank')
    if (!w) { addToast('Popup diblokir browser.', 'error'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${activeBlueprint?.name || 'PRD'}</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#18181b;line-height:1.7}
      h1,h2,h3,h4{font-family:Georgia,serif} pre{background:#f4f4f5;padding:14px;border-radius:8px;overflow:auto;font-size:12px}
      code{background:#f4f4f5;padding:2px 5px;border-radius:4px} svg{max-width:100%}</style></head><body>${el.innerHTML}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }, [activeBlueprint, addToast])

  // Export the first Mermaid diagram as SVG or PNG.
  const exportDiagram = useCallback((format) => {
    const svgEl = document.querySelector('.prd-diagram svg')
    if (!svgEl) { addToast('Tidak ada diagram untuk diekspor.', 'error'); return }
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const safe = (activeBlueprint?.name || 'diagram').replace(/\s+/g, '-').toLowerCase()
    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = `${safe}.svg`; a.click(); URL.revokeObjectURL(url)
      return
    }
    // PNG: rasterize via canvas
    const img = new Image()
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      const rect = svgEl.getBoundingClientRect()
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = (rect.width || 800) * scale; canvas.height = (rect.height || 600) * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, rect.width || 800, rect.height || 600)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        const u = URL.createObjectURL(blob); const a = document.createElement('a')
        a.href = u; a.download = `${safe}.png`; a.click(); URL.revokeObjectURL(u)
      })
    }
    img.onerror = () => { URL.revokeObjectURL(url); addToast('Gagal mengekspor diagram.', 'error') }
    img.src = url
  }, [activeBlueprint, addToast])

  // Duplicate the blueprint (optionally as a template).
  const duplicate = useCallback(async (asTemplate) => {
    if (!activeBlueprint) return
    try {
      const copy = await api.duplicateBlueprint(activeBlueprint.id, asTemplate)
      addToast(asTemplate ? 'Disimpan sebagai template.' : 'Proyek diduplikasi.', 'success')
      await fetchWorkspace(); await selectBlueprint(copy.id)
    } catch (err) { addToast(err.message, 'error') }
  }, [activeBlueprint, addToast, fetchWorkspace, selectBlueprint])

  const duplicateFromList = useCallback(async (id, e) => {
    e?.stopPropagation()
    try {
      await api.duplicateBlueprint(id, false)
      addToast('Proyek diduplikasi.', 'success')
      await fetchWorkspace()
    } catch (err) { addToast(err.message, 'error') }
  }, [addToast, fetchWorkspace])

  const launchSandbox = useCallback(async () => {
    if (!activeBlueprint) return
    try { setLoading(true); const p = await api.createCodeProject(`Sandbox ${activeBlueprint.name}`, activeBlueprint.id); navigate(`/app/ide/${p.id}`) }
    catch (err) { addToast(err.message, 'error') } finally { setLoading(false) }
  }, [activeBlueprint, navigate, addToast])
  const handleShare = useCallback(async () => {
    if (!activeBlueprint) return
    try {
      const isPublic = !activeBlueprint.isPublic
      const u = await api.toggleShare(activeBlueprint.id, isPublic)
      setActiveBlueprint(u)
      if (isPublic) { navigator.clipboard.writeText(`${window.location.origin}/share/${u.shareToken}`); setCopiedLink(true); addToast('Link publik disalin!', 'success'); setTimeout(() => setCopiedLink(false), 2000) }
      else addToast('Berbagi dimatikan.', 'info')
    } catch (err) { addToast(err.message, 'error') }
  }, [activeBlueprint, addToast])
  const restoreVersion = useCallback(async (v) => {
    if (!activeBlueprint) return
    try { setLoading(true); await api.restoreVersion(activeBlueprint.id, v); addToast(`Kembali ke versi ${v}.`, 'success'); await selectBlueprint(activeBlueprint.id) }
    catch (err) { addToast(err.message, 'error') } finally { setLoading(false) }
  }, [activeBlueprint, addToast, selectBlueprint])
  const deleteBlueprint = useCallback(async (id, e) => {
    e?.stopPropagation()
    const ok = await confirm({ title: 'Hapus proyek?', message: 'Proyek ini akan dihapus permanen.', danger: true, confirmText: 'Hapus' })
    if (!ok) return
    try { await api.deleteBlueprint(id); setBlueprints((p) => p.filter((b) => b.id !== id)); addToast('Proyek dihapus.', 'success') }
    catch (err) { addToast(err.message, 'error') }
  }, [confirm, addToast])

  /* ======================= VIEWER ======================= */
  if (activeBlueprint) {
    let tags = []; try { tags = JSON.parse(activeBlueprint.tagsJson || '[]') } catch { /* */ }
    return (
      <div className="prd-viewer">
        <header className="prd-vhead">
          <button onClick={() => setActiveBlueprint(null)} className="ide-back" aria-label="Kembali"><ArrowLeft size={18} /></button>
          {isEditing
            ? <input name="blueprintName" aria-label="Nama PRD" autoComplete="off" value={editorName} onChange={(e) => setEditorName(e.target.value)} className="input" style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', padding: '6px 12px', maxWidth: 360 }} />
            : <h1 className="display" style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeBlueprint.name}</h1>}
          <span className="chip chip-lime" style={{ fontSize: 10 }}>{activeBlueprint.type}</span>
          <div style={{ flex: 1 }} />
          <div className="prd-segment">
            <button className={viewMode === 'render' ? 'is-active' : ''} onClick={() => setViewMode('render')} aria-pressed={viewMode === 'render'}><Eye size={14} /> Render</button>
            <button className={viewMode === 'markdown' ? 'is-active' : ''} onClick={() => setViewMode('markdown')} aria-pressed={viewMode === 'markdown'}><FileMd size={14} /> .md</button>
          </div>
        </header>

        <div className="prd-toolbar">
          <div className="prd-toolbar-group">
            <button className="prd-tbtn" onClick={copyDoc}>{copied ? <Check size={14} /> : <Copy size={14} />} Salin</button>
            <button className="prd-tbtn" onClick={exportMd}><Download size={14} /> .md</button>
            <button className="prd-tbtn" onClick={exportPdf}><FileDown size={14} /> PDF</button>
            <button className="prd-tbtn" onClick={() => exportDiagram('png')}><ImageIcon size={14} /> Diagram PNG</button>
            <button className="prd-tbtn" onClick={() => exportDiagram('svg')}><ImageIcon size={14} /> SVG</button>
            <button className="prd-tbtn" onClick={() => duplicate(false)}><CopyPlus size={14} /> Duplikat</button>
            <button className="prd-tbtn" onClick={() => duplicate(true)}><CopyPlus size={14} /> Template</button>
            <button className="prd-tbtn" onClick={() => (isEditing ? handleUpdate() : setIsEditing(true))} style={isEditing ? { background: 'var(--ink)', color: 'var(--on-ink)' } : null}>
              <Edit2 size={14} /> {isEditing ? 'Simpan' : 'Edit'}
            </button>
            <button className="prd-tbtn" onClick={handleShare}>{copiedLink ? <Check size={14} /> : <Share2 size={14} />} {activeBlueprint.isPublic ? 'Link' : 'Bagikan'}</button>
          </div>
          <div className="prd-toolbar-group">
            <div className="prd-version">
              <History size={14} />
              <select name="blueprintVersion" aria-label="Versi PRD" value={activeBlueprint.currentVersion} onChange={(e) => restoreVersion(e.target.value)}>
                {activeBlueprint.versions?.map((v) => <option key={v.id} value={v.version}>v{v.version} · {v.source}</option>)}
              </select>
            </div>
            <button className="prd-tbtn prd-tbtn-dark" onClick={launchSandbox} disabled={loading}><Code size={14} /> Bangun Kode</button>
          </div>
        </div>

        <div className="prd-revise">
          <Wand2 size={16} style={{ flexShrink: 0 }} />
          <input className="prd-revise-input" name="blueprintRevision" aria-label="Instruksi revisi PRD" autoComplete="off" placeholder="Revisi dokumen: misal 'tambah bab keamanan, ganti DB ke MongoDB'…"
            value={reviseText} onChange={(e) => setReviseText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doRevise() }} disabled={revising} />
          <button className="prd-revise-btn" onClick={doRevise} disabled={revising || !reviseText.trim()}>
            {revising ? <Loader2 size={15} className="aster-spin" /> : <ArrowRight size={15} />} Revisi
          </button>
        </div>

        <div className="prd-scroll">
          {revising ? (
            <div className="prd-revising">
              <div className="prd-revising-head"><Loader2 size={16} className="aster-spin" /> Dokumen sedang direvisi…</div>
              <pre className="prd-raw">{reviseStream || 'Menyiapkan revisi…'}</pre>
            </div>
          ) : isEditing ? (
            <textarea className="input" name="blueprintContent" aria-label="Konten markdown PRD" spellCheck={false} style={{ width: '100%', minHeight: '60vh', fontFamily: 'monospace', fontSize: 13.5, lineHeight: 1.6, resize: 'vertical' }}
              value={editorContent} onChange={(e) => setEditorContent(e.target.value)} />
          ) : viewMode === 'render' ? (
            <Markdown content={activeBlueprint.content} />
          ) : (
            <pre className="prd-raw">{activeBlueprint.content}</pre>
          )}
          {!revising && (
          <div className="prd-meta">
            <div className="prd-meta-field"><FolderInput size={14} /><input name="blueprintFolder" aria-label="Folder PRD" autoComplete="off" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder" /></div>
            <div className="prd-meta-field"><Tag size={14} /><input name="blueprintTags" aria-label="Tag PRD" autoComplete="off" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2" /></div>
            <button className="prd-tbtn" onClick={saveMeta}>Simpan Meta</button>
            {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>{tags.map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}</div>}
          </div>
          )}
        </div>
      </div>
    )
  }

  /* ======================= QUIZ (step-by-step) ======================= */
  if (phase === 'quiz') {
    const total = questions.length
    const q = questions[quizStep]
    const isLast = quizStep === total - 1
    const pct = total ? Math.round(((quizStep + 1) / total) * 100) : 0
    return (
      <div className="bolt-page">
        <div className="bolt-center" style={{ maxWidth: 620 }}>
          <button onClick={() => setPhase('composer')} className="btn-link" style={{ marginBottom: 18, alignSelf: 'flex-start' }}><ChevronLeft size={16} /> Ubah ide</button>

          <div className="quiz-progress">
            <div className="quiz-progress-bar"><span style={{ width: `${pct}%` }} /></div>
            <span className="quiz-progress-label">Pertanyaan {quizStep + 1} / {total}</span>
          </div>

          {q && (
            <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="quiz-step">
              <h1 className="display quiz-step-q">{q.question}</h1>
              <div className="quiz-opts">
                {q.options?.map((opt) => {
                  const active = answers[q.id] === opt
                  return (
                    <button key={opt} className={`quiz-opt ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, [q.id]: opt }))
                        if (!isLast) setTimeout(() => setQuizStep((s) => s + 1), 180)
                      }}>
                      <span className="quiz-radio">{active && <Check size={12} strokeWidth={3} />}</span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          <div className="quiz-nav">
            <button className="pill" disabled={quizStep === 0} onClick={() => setQuizStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft size={15} /> Kembali
            </button>
            {isLast ? (
              <button className="bolt-send" onClick={generate}><CornerDownLeft size={16} /> Buat Rencana</button>
            ) : (
              <button className="bolt-send" onClick={() => setQuizStep((s) => Math.min(total - 1, s + 1))}>Lanjut <ChevronRight size={15} /></button>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ======================= GENERATING ======================= */
  if (phase === 'generating') {
    return <GeneratingView stream={streamedPRD} scrollRef={genScrollRef} />
  }

  /* ======================= COMPOSER ======================= */
  const firstName = user?.name?.split(' ')[0] || 'Sobat'
  return (
    <div className="bolt-page">
      <div className="bolt-center">
        <div style={{ textAlign: 'center' }}>
          <h1 className="display bolt-title">Mau bangun apa hari ini, {firstName}?</h1>
          <p className="text-muted bolt-sub">Ceritakan idemu dengan bahasa biasa, rencana proyek (PRD) lengkap akan disusun otomatis.</p>

        </div>

        <div className="composer-glow-wrap">
          <div className="composer-glow" aria-hidden="true" />
          <BorderGlowCard
            borderRadius={22}
            glowRadius={60}
            backgroundColor="var(--surface)"
            className="bolt-composer"
            innerStyle={{ overflow: 'visible' }}
          >
            <input className="bolt-name" name="projectName" aria-label="Nama proyek" autoComplete="off" placeholder="Nama proyek (opsional)" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <textarea
              className="bolt-input"
              name="projectIdea"
              aria-label="Ide aplikasi"
              autoComplete="off"
              placeholder="Contoh: aplikasi kasir untuk warung dengan laporan harian dan stok barang…"
              value={idea} onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startQuiz() }}
              rows={3}
            />

            {/* tech mode toggle */}
            <div className="tech-mode">
              <button className={`tech-mode-btn ${techMode === 'auto' ? 'is-active' : ''}`} onClick={() => setTechMode('auto')} aria-pressed={techMode === 'auto'}>
                <Bot size={15} /> Auto AI
                <span className="tech-mode-desc">AI pilih tech stack</span>
              </button>
              <button className={`tech-mode-btn ${techMode === 'manual' ? 'is-active' : ''}`} onClick={() => setTechMode('manual')} aria-pressed={techMode === 'manual'}>
                <Wrench size={15} /> Manual
                <span className="tech-mode-desc">Pilih sendiri</span>
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="bolt-attach-row" style={{ padding: '0 20px 10px' }}>
                {attachments.map((a, i) => (
                  <span key={i} className="bolt-attach-chip">
                    {a.type === 'image'
                      ? <img src={a.dataUrl} alt={a.name} width="22" height="22" className="bolt-attach-thumb" />
                      : <ImageIcon size={13} />}
                    <span className="bolt-attach-name">{a.name}</span>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} aria-label="Hapus lampiran"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}

            {/* GitHub URL input inside card */}
            {showGithubInput && (
              <div className="chat-github-bar" style={{ padding: '0 20px 10px', background: 'transparent', borderTop: 'none' }}>
                <div className="chat-github-inner" style={{ background: 'var(--surface-2)' }}>
                  <GitBranch size={14} className="chat-github-ic" />
                  <input
                    className="chat-github-input"
                    name="githubRepositoryUrl"
                    type="url"
                    aria-label="URL repository GitHub"
                    autoComplete="url"
                    spellCheck={false}
                    placeholder="https://github.com/owner/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGithubAnalyze(githubUrl) } }}
                    disabled={analyzingGithub}
                  />
                  <button
                    className="chat-github-btn"
                    onClick={() => handleGithubAnalyze(githubUrl)}
                    disabled={!githubUrl.trim() || analyzingGithub}
                  >
                    {analyzingGithub ? 'Menganalisis…' : 'Analisis'}
                  </button>
                  <button className="chat-github-close" onClick={() => { setShowGithubInput(false); setGithubUrl('') }} aria-label="Tutup input GitHub">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="bolt-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, flexWrap: 'wrap' }}>
              {/* Left: Template & Models Selection Dropdowns */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Dropdown value={template} onChange={setTemplate} options={TEMPLATE_OPTIONS} icon={Layers} />
                {techMode === 'manual' && (
                  <>
                    <Dropdown label="FE" value={frontend} onChange={setFrontend} options={FRONTEND_OPTIONS} />
                    <Dropdown label="BE" value={backend} onChange={setBackend} options={BACKEND_OPTIONS} icon={Server} />
                    <Dropdown label="DB" value={database} onChange={setDatabase} options={DATABASE_OPTIONS} icon={Database} />
                    <Dropdown label="Deploy" value={deploy} onChange={setDeploy} options={DEPLOY_OPTIONS} icon={Cloud} />
                  </>
                )}
                <Dropdown label="Model" value={model} onChange={setModel} options={buildModelOptions(adminModels, aiKeys, user?.role === 'ADMIN' ? 'ADMIN' : (quota ? quota.planType : 'LOADING'))} align="right" />
              </div>
              
              {/* Right: Attachments & Continue Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <ComposerToolbar
                  fileInputRef={fileInputRef}
                  imageInputRef={imageInputRef}
                  triggerFilePicker={triggerFilePicker}
                  triggerImagePicker={triggerImagePicker}
                  onPickFiles={onPickFiles}
                  showGithubInput={showGithubInput}
                  toggleGithubInput={() => setShowGithubInput((v) => !v)}
                />
                <button className="bolt-send" onClick={startQuiz} disabled={loading || !idea.trim()}>
                  {loading ? <Loader2 size={16} className="aster-spin" /> : <CornerDownLeft size={16} />}
                  <span>Lanjut</span>
                </button>
              </div>
            </div>
          </BorderGlowCard>
        </div>

        <div className="bolt-suggest">
          {SUGGESTIONS_STORE.map((s) => (
            <button key={s} className="bolt-chip" onClick={() => setIdea(s)}>{s}</button>
          ))}
        </div>
      </div>

      {wsLoading ? (
        <div className="bolt-history"><SkeletonGrid count={3} lines={2} /></div>
      ) : blueprints.length > 0 && (
        <div className="bolt-history">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <h2 className="display" style={{ fontSize: 17 }}>Riwayat Proyek</h2>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="input" name="projectSearch" aria-label="Cari proyek" autoComplete="off" style={{ paddingLeft: 36, height: 38, maxWidth: 260 }} placeholder="Cari proyek…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {/* Folder filter */}
          {allFolders.length > 0 && (
            <div className="filter-row">
              <Folder size={14} className="text-muted" />
              <button className={`filter-chip ${activeFolder === 'all' ? 'is-active' : ''}`} onClick={() => setActiveFolder('all')} aria-pressed={activeFolder === 'all'}>Semua</button>
              {allFolders.map((f) => (
                <button key={f} className={`filter-chip ${activeFolder === f ? 'is-active' : ''}`} onClick={() => setActiveFolder(f)} aria-pressed={activeFolder === f}>{f}</button>
              ))}
            </div>
          )}
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="filter-row">
              <Tag size={14} className="text-muted" />
              {allTags.map((tg) => (
                <button key={tg} className={`filter-chip ${activeTag === tg ? 'is-active' : ''}`} onClick={() => setActiveTag(activeTag === tg ? null : tg)} aria-pressed={activeTag === tg}>{tg}</button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <BorderGlowCard borderRadius={20} style={{ marginTop: 14 }} innerStyle={{ borderRadius: 20, padding: 32, textAlign: 'center' }}>
              <p className="text-muted" style={{ fontSize: 14 }}>Tidak ada proyek yang cocok dengan filter.</p>
            </BorderGlowCard>
          ) : (
            <div className="hist-grid" style={{ marginTop: 14 }}>
              {filtered.map((bp) => <HistoryCard key={bp.id} bp={bp} onOpen={selectBlueprint} onDelete={deleteBlueprint} onDuplicate={duplicateFromList} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
