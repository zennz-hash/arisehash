import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Loader2, CornerDownLeft, Code2, ArrowUpRight, Trash2, Zap, Brain,
  Layers, Bot, Smartphone, Globe, Search, X, Image as ImageIcon, GitBranch
} from 'lucide-react'
import { api } from '../api.js'
import { parseModelSelection, buildModelOptions } from '../model-utils.js'
import Dropdown from '../components/Dropdown.jsx'
import { SkeletonGrid } from '../components/Skeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import ComposerToolbar from '../components/ComposerToolbar.jsx'
import { useFileAttachments } from '../utils/useFileAttachments.js'
import { useGithubAnalyzer } from '../utils/useGithubAnalyzer.js'
import { STACKS, SUGGESTIONS_CODE } from '../constants.js'

// Map icon names from SUGGESTIONS_CODE to actual lucide components
const SUGGESTION_ICONS = { Layers, Bot, Globe, Smartphone }



export default function BuildCode() {
  const { user, ready } = useAuth()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [prompt, setPrompt] = useState('')
  const [name, setName] = useState('')
  const [model, setModel] = useState(null)
  const [adminModels, setAdminModels] = useState([])
  const [aiKeyId, setAiKeyId] = useState(null)
  const [aiKeys, setAiKeys] = useState([])
  const [quota, setQuota] = useState(null)
  const [stack, setStack] = useState('react')
  const [creating, setCreating] = useState(false)
  const [projects, setProjects] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [query, setQuery] = useState('')

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

  const loadProjects = useCallback(async () => {
    if (!user) return
    try { const res = await api.codeProjects(); setProjects(res?.items || res || []) }
    catch (err) { addToast(err.message, 'error') }
    finally { setLoadingList(false) }
  }, [user, addToast])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => {
    if (!user) return
    api.models().then((models) => {
      const list = Array.isArray(models) ? models : []
      setAdminModels(list)
    }).catch(() => {})
    api.aiKeys().then(setAiKeys).catch(() => {})
    api.quota().then(setQuota).catch(() => {})
  }, [user])

  useEffect(() => {
    if (adminModels.length > 0 && quota) {
      const isAdmin = user?.role === 'ADMIN'
      const planType = isAdmin ? 'ADMIN' : quota.planType
      if (planType === 'FREE') {
        const freeModel = adminModels.find((m) => m.model.startsWith('mimo-v2.5'))
        if (freeModel) {
          setModel(freeModel.id)
        } else if (model === null) {
          setModel(adminModels[0].id)
        }
      } else {
        if (model === null) {
          setModel(adminModels[0].id)
        }
      }
    }
  }, [model, adminModels, quota, user])

  const startBuild = useCallback(async () => {
    const idea = prompt.trim()
    if (!idea || creating) return
    setCreating(true)
    try {
      const projName = name.trim() || idea.slice(0, 40)
      const { model: m, aiKeyId: k } = parseModelSelection(aiKeyId ? `key:${aiKeyId}` : model)
      const project = await api.createCodeProject(projName, null, stack, m, k)
      // Pass the first instruction (+ attachments) to the IDE so it auto-runs.
      navigate(`/app/ide/${project.id}`, { state: { initialPrompt: idea, model: m, attachments, aiKeyId: k } })
    } catch (err) {
      addToast(err.message, 'error')
      setCreating(false)
    }
  }, [prompt, name, model, stack, attachments, aiKeyId, creating, navigate, addToast])

  const openProject = useCallback((id) => navigate(`/app/ide/${id}`), [navigate])

  const removeProject = useCallback(async (id, e) => {
    e?.stopPropagation()
    const ok = await confirm({ title: 'Hapus proyek kode?', message: 'Workspace ini akan dihapus permanen.', danger: true, confirmText: 'Hapus' })
    if (!ok) return
    try {
      await api.deleteCodeProject(id)
      setProjects((p) => p.filter((x) => x.id !== id))
      addToast('Proyek kode dihapus.', 'success')
    } catch (err) { addToast(err.message, 'error') }
  }, [confirm, addToast])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); startBuild() }
  }

  if (!ready) {
    return <div className="dash-page" style={{ textAlign: 'center', paddingTop: 60 }}><p className="text-muted">Memuat...</p></div>
  }
  if (!user) {
    return (
      <div className="dash-page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: '40px 32px', maxWidth: 460, textAlign: 'center' }}>
          <Code2 size={30} className="text-indigo-600" style={{ marginBottom: 12 }} />
          <h2 className="display" style={{ fontSize: 24, marginBottom: 14 }}>Masuk untuk Mulai Membangun</h2>
          <Link to="/login" className="pill pill-indigo">Masuk</Link>
        </div>
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] || 'Sobat'
  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="bolt-page">
      <div className="bolt-center">
        <div style={{ textAlign: 'center' }}>
          <span className="bolt-badge"><Code2 size={13} /> Bangun Kode</span>
          <h1 className="display bolt-title">Mau bangun aplikasi apa, {firstName}?</h1>
          <p className="text-muted bolt-sub">Jelaskan aplikasi yang kamu inginkan, kodenya ditulis langsung di editor — chat di kiri, preview & code di kanan.</p>

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
            <input className="bolt-name" placeholder="Nama proyek (opsional)" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea
              className="bolt-input"
              placeholder="Contoh: aplikasi cuaca dengan input kota, kartu suhu, dan ikon kondisi langit..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
            />

            {attachments.length > 0 && (
              <div className="bolt-attach-row">
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
                    {analyzingGithub ? 'Menganalisis...' : 'Analisis'}
                  </button>
                  <button className="chat-github-close" onClick={() => { setShowGithubInput(false); setGithubUrl('') }} aria-label="Tutup input GitHub">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="bolt-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, flexWrap: 'wrap' }}>
              {/* Left: Stack & Model Dropdowns */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Dropdown label="Stack" value={stack} onChange={setStack} options={STACKS} icon={Code2} />
                <Dropdown
                  label="Model"
                  icon={aiKeyId ? Code2 : Zap}
                  value={aiKeyId ? `key:${aiKeyId}` : model}
                  onChange={(v) => {
                    if (v.startsWith('key:')) {
                      setAiKeyId(v.slice(4))
                    } else {
                      setModel(v)
                      setAiKeyId(null)
                    }
                  }}
                  options={buildModelOptions(adminModels, aiKeys, user?.role === 'ADMIN' ? 'ADMIN' : (quota ? quota.planType : 'LOADING'))}
                />
              </div>
              
              {/* Right: Attachments & Build Button */}
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
                <button className="bolt-send" onClick={startBuild} disabled={creating || !prompt.trim()}>
                  {creating ? <Loader2 size={16} className="aster-spin" /> : <CornerDownLeft size={16} />}
                  <span>{creating ? 'Menyiapkan...' : 'Bangun'}</span>
                </button>
              </div>
            </div>
          </BorderGlowCard>
        </div>

        <div className="bolt-suggest">
          {SUGGESTIONS_CODE.map((s) => {
            const SuggIcon = SUGGESTION_ICONS[s.iconName]
            return (
              <button key={s.label} className="bolt-chip" onClick={() => setPrompt(s.text)}>
                {SuggIcon && <SuggIcon size={14} />} {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {loadingList ? (
        <div className="bolt-history"><SkeletonGrid count={3} lines={2} /></div>
      ) : projects.length > 0 && (
        <div className="bolt-history">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <h2 className="display" style={{ fontSize: 17 }}>Workspace Kode</h2>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 36, height: 38, maxWidth: 260 }} placeholder="Cari proyek..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState compact icon={Search} title="Tidak ada yang cocok" desc="Coba kata kunci lain untuk menemukan proyekmu." />
          ) : (
            <div className="hist-grid">
              {filtered.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card hist-card">
                  <div>
                    <span className="dash-action-ic" style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 12 }}><Code2 size={18} /></span>
                    <h3 className="display" style={{ fontSize: 15, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h3>
                    <p className="text-muted" style={{ fontSize: 12 }}>Diperbarui {new Date(p.updatedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <button className="dash-hist-del" onClick={(e) => removeProject(p.id, e)} title="Hapus" aria-label="Hapus proyek"><Trash2 size={14} /></button>
                    <button onClick={() => openProject(p.id)} className="pill" style={{ padding: '6px 13px', fontSize: 12.5 }}>Buka <ArrowUpRight size={13} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
