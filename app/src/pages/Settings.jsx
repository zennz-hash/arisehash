import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User as UserIcon, Globe, CreditCard, LogOut, Check, ArrowUpRight, Pencil, Trash2, AlertTriangle, Activity, FileText, Code2, Zap, Monitor, ShieldCheck, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import Tabs from '../components/Tabs.jsx'
import { uAgo, USAGE_LABEL } from '../utils/time.js'
import { fadeIn } from '../utils/framer.js'

function QuotaBar({ label, used, total }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const color = pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : 'var(--indigo, #6366f1)'
  return (
    <div className="settings-quota-bar">
      <div className="settings-quota-bar-head">
        <span>{label}</span>
        <span>{used}/{total}</span>
      </div>
      <div className="settings-quota-track">
        <div className="settings-quota-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const { lang, setLang, langs } = useLang()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [quota, setQuota] = useState(null)
  const [tab, setTab] = useState('akun') // akun | penggunaan
  const [usage, setUsage] = useState(null)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(user?.name || '')
  const [savingName, setSavingName] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let on = true
    api.quota().then((q) => on && setQuota(q)).catch(() => {})
    api.usage().then((u) => on && setUsage(u)).catch(() => {})
    return () => { on = false }
  }, [])

  const handleLogout = async () => { await logout(); navigate('/') }
  const planLabel = (quota?.planType || 'FREE').toLowerCase().replace('_', ' ')

  const saveName = async () => {
    const name = nameInput.trim()
    if (!name) { addToast('Nama tidak boleh kosong.', 'error'); return }
    setSavingName(true)
    try {
      const { user: u } = await api.updateProfile(name)
      updateUser(u)
      addToast('Nama berhasil diperbarui.', 'success')
      setEditingName(false)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingName(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api.deleteAccount()
      addToast('Akun dihapus.', 'success')
      await logout()
      navigate('/')
    } catch (err) {
      addToast(err.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <div className="dash-page">
      <motion.div {...fadeIn(0)}>
        <span className="eyebrow">Pengaturan</span>
        <h1 className="display h-md" style={{ marginTop: 8 }}>Pengaturan Akun</h1>
        <p className="text-muted" style={{ fontSize: 15, marginTop: 6 }}>Kelola profil, bahasa, paket, dan pantau penggunaanmu.</p>
      </motion.div>

      <div className="settings-layout">
        {/* Main column */}
        <div className="settings-main">
          <Tabs
            tabs={[
              { id: 'akun', label: 'Akun', icon: UserIcon },
              { id: 'penggunaan', label: 'Penggunaan', icon: Activity },
              { id: 'model', label: 'Model AI', icon: Code2 },
              { id: 'skills', label: 'Agen Skills', icon: Zap },
              { id: 'keamanan', label: 'Keamanan', icon: ShieldCheck },
            ]}
            activeTab={tab}
            onChange={setTab}
          />

          {tab === 'model' ? (
            <AiModelsTab addToast={addToast} />
          ) : tab === 'keamanan' ? (
            <SecurityTab addToast={addToast} logout={logout} navigate={navigate} />
          ) : tab === 'penggunaan' ? (
            <UsageTab usage={usage} quota={quota} />
          ) : tab === 'skills' ? (
            <SkillsTab addToast={addToast} />
          ) : (
          <>
          <motion.div {...fadeIn(0.05)} className="card" style={{ padding: 24, marginTop: 24 }}>
            <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <UserIcon size={16} /> Profil
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
               <span className="dash-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
                 {user?.picture && (
                   <img 
                     src={user.picture} 
                     alt={user?.name || 'User'} 
                     width="56"
                     height="56"
                     onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'inline'; }} 
                   />
                 )}
                 <span style={{ display: user?.picture ? 'none' : 'inline' }}>
                   {user?.initials || 'U'}
                 </span>
               </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="input" style={{ maxWidth: 260, height: 42 }} value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)} maxLength={80} autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') saveName() }} />
                    <button className="pill pill-indigo" onClick={saveName} disabled={savingName} style={{ padding: '8px 14px' }}>
                      {savingName ? '...' : 'Simpan'}
                    </button>
                    <button className="pill" onClick={() => { setEditingName(false); setNameInput(user?.name || '') }} style={{ padding: '8px 14px' }}>Batal</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="display" style={{ fontSize: 18 }}>{user?.name}</span>
                    <button className="dash-hist-del" onClick={() => { setNameInput(user?.name || ''); setEditingName(true) }} title="Ubah nama" aria-label="Ubah nama"><Pencil size={14} /></button>
                  </div>
                )}
                <div className="text-muted" style={{ fontSize: 14, wordBreak: 'break-all', marginTop: 4 }}>{user?.email}</div>
                <span className="chip" style={{ marginTop: 8, fontSize: 10.5, padding: '3px 8px' }}>Masuk via Google</span>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeIn(0.1)} className="card" style={{ padding: 24, marginTop: 18 }}>
            <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Globe size={16} /> Bahasa
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {langs.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className="pill"
                  style={lang === l.code ? { background: 'var(--ink)', color: 'var(--on-ink)', borderColor: 'var(--ink)' } : {}}
                >
                  {lang === l.code && <Check size={15} strokeWidth={3} />} {l.name}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeIn(0.15)} className="card" style={{ padding: 24, marginTop: 18 }}>
            <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CreditCard size={16} /> Paket Langganan
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="display" style={{ fontSize: 20, textTransform: 'capitalize' }}>{planLabel}</div>
                {quota && (
                  <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                    Sisa hari ini: {Math.max(0, quota.prdQuota - quota.quotaUsedToday)} rencana proyek
                  </p>
                )}
              </div>
              <Link to="/app/upgrade" className="pill pill-indigo">
                Lihat Paket Lain <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
              </Link>
            </div>
          </motion.div>

          <motion.div {...fadeIn(0.2)} style={{ marginTop: 18 }}>
            <button onClick={handleLogout} className="pill" style={{ borderColor: 'var(--line)' }}>
              <LogOut size={16} /> Keluar dari Akun
            </button>
          </motion.div>

          <motion.div {...fadeIn(0.25)} className="card" style={{ padding: 24, marginTop: 26, borderColor: '#e0b4b4' }}>
            <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#b3261e' }}>
              <AlertTriangle size={16} /> Zona Berbahaya
            </h3>
            <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
              Menghapus akun bersifat permanen. Seluruh proyek, kode, dan percakapanmu akan ikut terhapus dan tidak bisa dikembalikan.
            </p>
            {!confirmDelete ? (
              <button className="pill" style={{ borderColor: '#d9534f', color: '#b3261e' }} onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Hapus Akun
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#b3261e' }}>Yakin? Tindakan ini permanen.</span>
                <button className="pill" style={{ background: '#b3261e', color: '#fff', borderColor: '#b3261e' }} onClick={deleteAccount} disabled={deleting}>
                  {deleting ? 'Menghapus...' : 'Ya, hapus akun saya'}
                </button>
                <button className="pill" onClick={() => setConfirmDelete(false)}>Batal</button>
              </div>
            )}
          </motion.div>
          </>
          )}
        </div>

        {/* Right info panel */}
        <aside className="settings-side">
          <div className="card" style={{ padding: 22, textAlign: 'center' }}>
             <span className="dash-avatar" style={{ width: 72, height: 72, fontSize: 28, margin: '0 auto 12px' }}>
               {user?.picture && (
                 <img 
                   src={user.picture} 
                   alt={user?.name || 'User'} 
                   width="72"
                   height="72"
                   onError={(e) => {
                     e.target.style.display = 'none';
                     if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                   }} 
                 />
               )}
               <span style={{ display: user?.picture ? 'none' : 'inline' }}>
                 {user?.initials || 'U'}
               </span>
             </span>
            <div className="display" style={{ fontSize: 17 }}>{user?.name}</div>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 2, wordBreak: 'break-all' }}>{user?.email}</div>
            <span className="chip" style={{ marginTop: 10, fontSize: 11, padding: '4px 10px', textTransform: 'capitalize' }}>{planLabel}</span>
          </div>

          {quota && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <h3 className="display" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}><Zap size={15} /> Ringkasan Kuota</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                <QuotaBar label="PRD / Proyek" used={quota.quotaUsedToday || 0} total={quota.prdQuota || 1} />
                <QuotaBar label="Kredit AI (Kode)" used={quota.codeQuotaUsedToday || 0} total={quota.codeQuota || 100} />
                <QuotaBar label="Kredit AI (Chat)" used={quota.usage?.chatStandard ?? 0} total={quota.limits?.chatStandard ?? 100} />
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 18, marginTop: 14 }}>
            <h3 className="display" style={{ fontSize: 14, marginBottom: 10 }}>Aksi Cepat</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/app/build-project" className="pill" style={{ justifyContent: 'center', padding: '9px 14px', fontSize: 13 }}>
                <FileText size={14} /> Bangun Proyek Baru
              </Link>
              <Link to="/app/build-code" className="pill" style={{ justifyContent: 'center', padding: '9px 14px', fontSize: 13 }}>
                <Code2 size={14} /> Bangun Kode
              </Link>
              <Link to="/app/asisten" className="pill" style={{ justifyContent: 'center', padding: '9px 14px', fontSize: 13 }}>
                <Activity size={14} /> Buka Asisten
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function SecurityTab({ addToast, logout, navigate }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setSessions(await api.sessions()) }
    catch (err) { addToast(err.message, 'error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const revoke = async (s) => {
    try {
      await api.revokeSession(s.id)
      addToast(s.current ? 'Sesi saat ini dicabut.' : 'Sesi dicabut.', 'success')
      if (s.current) { await logout(); navigate('/') }
      else load()
    } catch (err) { addToast(err.message, 'error') }
  }
  const logoutAll = async () => {
    try {
      await api.logoutAll()
      addToast('Semua sesi dicabut.', 'success')
      await logout()
      navigate('/')
    } catch (err) { addToast(err.message, 'error') }
  }

  return (
    <motion.div {...fadeIn(0.05)} className="card" style={{ padding: 24, marginTop: 24 }}>
      <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <ShieldCheck size={16} /> Sesi Aktif
      </h3>
      <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 16 }}>Pantau perangkat yang masih login dan cabut sesi yang tidak dikenal.</p>
      {loading ? (
        <p className="text-muted" style={{ fontSize: 13 }}>Memuat sesi...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map((s) => (
            <div key={s.id} className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="dash-action-ic" style={{ width: 38, height: 38, borderRadius: 10 }}><Monitor size={16} /></span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.current ? 'Sesi saat ini' : 'Sesi lain'} {s.current && <span className="chip" style={{ fontSize: 9, marginLeft: 6 }}>Aktif</span>}</div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>{s.userAgent || 'Browser tidak diketahui'}</div>
                <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>Login {new Date(s.createdAt).toLocaleString('id-ID')} · IP {s.ipAddress || '—'}</div>
              </div>
              <button className="pill" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => revoke(s)}>Cabut</button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Tidak ada sesi aktif.</p>}
        </div>
      )}
      <button className="pill" style={{ marginTop: 16, borderColor: '#d9534f', color: '#b3261e' }} onClick={logoutAll}>
        <LogOut size={15} /> Logout Semua Perangkat
      </button>
    </motion.div>
  )
}
function AiModelsTab({ addToast }) {
  const PRESETS = [
    { value: 'openai', label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { value: 'anthropic', label: 'Anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
    { value: 'openrouter', label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
    { value: 'groq', label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    { value: 'together', label: 'Together AI', base: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    { value: 'custom', label: 'Custom', base: '', model: '' },
  ]

  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok: true/false, message, reply } or null
  const [form, setForm] = useState({ label: '', provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' })

  const load = async () => {
    try { setKeys(await api.aiKeys()) } catch (err) { addToast(err.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const applyPreset = (value) => {
    const p = PRESETS.find((x) => x.value === value) || PRESETS[0]
    setForm((f) => ({ ...f, provider: p.value, baseUrl: p.base, model: p.model }))
    setTestResult(null)
  }

  const testConnection = async () => {
    if (!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()) {
      addToast('Base URL, API key, dan model wajib diisi untuk tes.', 'error'); return
    }
    setTestingConnection(true)
    setTestResult(null)
    try {
      const r = await api.testAiConnection({ baseUrl: form.baseUrl, apiKey: form.apiKey, model: form.model, provider: form.provider })
      setTestResult({ ok: true, message: r.message, reply: r.reply })
      addToast(r.message || 'Koneksi berhasil.', 'success')
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Koneksi gagal.' })
      addToast(err.message || 'Koneksi gagal.', 'error')
    } finally {
      setTestingConnection(false)
    }
  }

  const submit = async () => {
    if (!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()) {
      addToast('Base URL, API key, dan model wajib diisi.', 'error'); return
    }
    setBusy(true)
    try {
      await api.createAiKey(form)
      addToast('Model berhasil ditambahkan.', 'success')
      setShowForm(false)
      setTestResult(null)
      setForm({ label: '', provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' })
      load()
    } catch (err) { addToast(err.message, 'error') } finally { setBusy(false) }
  }

  const remove = async (id) => {
    try { await api.deleteAiKey(id); setKeys((p) => p.filter((k) => k.id !== id)); addToast('Model dihapus.', 'success') }
    catch (err) { addToast(err.message, 'error') }
  }

  const test = async (id) => {
    setTestingId(id)
    try { const r = await api.testAiKey(id); addToast(r.message || 'Koneksi berhasil.', 'success') }
    catch (err) { addToast(err.message || 'Koneksi gagal.', 'error') } finally { setTestingId(null) }
  }

  return (
    <motion.div {...fadeIn(0.05)} style={{ marginTop: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code2 size={16} /> Model AI Sendiri
          </h3>
          {!showForm && <button className="pill pill-indigo" style={{ padding: '8px 14px' }} onClick={() => setShowForm(true)}>+ Tambah Model</button>}
        </div>
        <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
          Pakai API key milikmu sendiri (OpenAI-compatible). Saat dipilih di Build Code / Build Project,
          generate memakai model ini dan <strong>tidak memotong kuota</strong>. Key disimpan terenkripsi.
        </p>

        {showForm && (
          <div className="card" style={{ padding: 18, background: 'var(--bg-2)', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span className="settings-label">Penyedia</span>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {PRESETS.map((p) => (
                    <button key={p.value} type="button"
                      className={`filter-chip ${form.provider === p.value ? 'is-active' : ''}`}
                      onClick={() => applyPreset(p.value)}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="settings-label" htmlFor="ai-model-label">Label (opsional)</label>
                <input id="ai-model-label" name="label" className="input" autoComplete="off" placeholder="mis. GPT-4o pribadi" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
              </div>
              <div>
                <label className="settings-label" htmlFor="ai-model-base-url">Base URL</label>
                <input id="ai-model-base-url" name="baseUrl" type="url" className="input" autoComplete="url" placeholder="https://api.openai.com/v1" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} />
              </div>
              <div>
                <label className="settings-label" htmlFor="ai-model-name">Model</label>
                <input id="ai-model-name" name="model" className="input" autoComplete="off" placeholder="gpt-4o-mini" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              </div>
              <div>
                <label className="settings-label" htmlFor="ai-model-api-key">API Key</label>
                <input id="ai-model-api-key" name="apiKey" className="input" type="password" autoComplete="off" placeholder="sk-..." value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="pill pill-indigo" onClick={submit} disabled={busy} style={{ padding: '9px 16px' }}>{busy ? 'Menyimpan...' : 'Simpan Model'}</button>
                <button className="pill" onClick={testConnection} disabled={testingConnection} style={{ padding: '9px 16px', borderColor: 'var(--line)' }}>
                  {testingConnection ? <><Wifi size={14} style={{ animation: 'spin 1s linear infinite' }} /> Menguji...</> : <><Wifi size={14} /> Tes Koneksi</>}
                </button>
                <button className="pill" onClick={() => { setShowForm(false); setTestResult(null) }} style={{ padding: '9px 16px' }}>Batal</button>
              </div>
              {testResult && (
                <div className="card" style={{
                  padding: 12, marginTop: 4,
                  borderColor: testResult.ok ? '#4ade80' : '#f87171',
                  background: testResult.ok ? 'rgba(74, 222, 128, 0.06)' : 'rgba(248, 113, 113, 0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: testResult.ok ? '#16a34a' : '#dc2626' }}>
                    {testResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    {testResult.message}
                  </div>
                  {testResult.ok && testResult.reply && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 6, fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      Reply: {testResult.reply}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted" style={{ fontSize: 13 }}>Memuat...</p>
        ) : keys.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13 }}>Belum ada model. Tambahkan satu untuk memakai API key sendiri.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {keys.map((k) => (
              <div key={k.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="dash-action-ic" style={{ width: 38, height: 38, borderRadius: 10 }}><Code2 size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{k.label} <span className="chip" style={{ fontSize: 9.5, marginLeft: 4 }}>{k.provider}</span></div>
                  <div className="text-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {k.model} · {k.keyMasked} · dipakai {k.usageCount || 0}x{k.lastUsedAt ? ` · terakhir ${uAgo(k.lastUsedAt)}` : ''}
                  </div>
                </div>
                <button className="pill" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => test(k.id)} disabled={testingId === k.id}>
                  {testingId === k.id ? 'Menguji...' : 'Tes'}
                </button>
                <button className="dash-hist-del" onClick={() => remove(k.id)} title="Hapus" aria-label="Hapus model"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}


function UsageBars({ series }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...series)
  const labels = ['6h', '5h', '4h', '3h', '2h', 'Kmrn', 'Hari ini']
  const yTicks = 4
  return (
    <div className="usage-chart">
      {/* y axis grid */}
      <div className="usage-chart-grid">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = Math.round(max - (max / yTicks) * i)
          return (
            <div key={i} className="usage-chart-grid-row">
              <span className="usage-chart-axis">{val}</span>
              <span className="usage-chart-grid-line" />
            </div>
          )
        })}
      </div>
      {/* bars */}
      <div className="usage-bars">
        {series.map((v, i) => {
          const pct = (v / max) * 100
          return (
            <div
              key={i}
              className={`usage-bar-col ${hover === i ? 'is-active' : ''}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="usage-bar-track">
                <div className="usage-bar-fill" style={{ height: `${pct}%` }}>
                  {v > 0 && <span className="usage-bar-val">{v}</span>}
                </div>
              </div>
              <span className="usage-bar-label">{labels[i] || ''}</span>
              {hover === i && (
                <div className="usage-bar-tip">{v} aktivitas</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UsageTab({ usage, quota }) {
  const resetAt = quota?.nextResetAt ? new Date(quota.nextResetAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'
  const quotaRows = [
    ['PRD / Build Project', quota?.usage?.prd ?? quota?.quotaUsedToday, quota?.limits?.prd ?? quota?.prdQuota, quota?.remaining?.prd],
    ['Kredit AI (Chat)', quota?.usage?.chatStandard ?? quota?.codeQuotaUsedToday, quota?.limits?.chatStandard ?? quota?.codeQuota, quota?.remaining?.chatStandard],
    ['Kredit AI (Kode)', quota?.usage?.code ?? quota?.codeQuotaUsedToday, quota?.limits?.code ?? quota?.codeQuota, quota?.remaining?.code],
    ['Max Thinking', quota?.usage?.maxThinking ?? quota?.codeQuotaUsedToday, quota?.limits?.maxThinking ?? quota?.codeQuota, quota?.remaining?.maxThinking],
  ]
  return (
    <div style={{ marginTop: 24 }}>
      <div className="dash-grid">
        <div className="card dash-stat">
          <span className="dash-stat-ic"><FileText size={20} color="var(--on-ink)" /></span>
          <div><div className="dash-stat-val">{usage?.totalPrd ?? '—'}</div><div className="dash-stat-label">Total PRD dibuat</div></div>
        </div>
        <div className="card dash-stat">
          <span className="dash-stat-ic"><Code2 size={20} color="var(--on-ink)" /></span>
          <div><div className="dash-stat-val">{usage?.totalCode ?? '—'}</div><div className="dash-stat-label">Total generate kode</div></div>
        </div>
        <div className="card dash-stat">
          <span className="dash-stat-ic"><Zap size={20} color="var(--on-ink)" /></span>
          <div><div className="dash-stat-val">{quota ? `${quota.quotaUsedToday}/${quota.prdQuota}` : '—'}</div><div className="dash-stat-label">Kuota hari ini</div></div>
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginTop: 18 }}>
        <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Zap size={16} /> Breakdown Kuota
        </h3>
        <div className="usage-breakdown">
          {quotaRows.map(([label, used = 0, limit = 0, remaining = 0]) => {
            const pct = limit ? Math.min(100, (used / limit) * 100) : 0
            return (
              <div key={label} className="usage-breakdown-row">
                <div className="usage-breakdown-head">
                  <span className="usage-breakdown-label">{label}</span>
                  <span className="usage-breakdown-meta">{used}/{limit} · sisa {remaining}</span>
                </div>
                <div className="usage-bar-track" style={{ height: 9 }}>
                  <div
                    className="usage-bar-fill"
                    style={{ height: '100%', width: `${pct}%` }}
                    data-level={pct >= 90 ? 'high' : pct >= 70 ? 'mid' : 'ok'}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>Reset berikutnya: {resetAt} WIB.</p>
      </div>

      <div className="card" style={{ padding: 22, marginTop: 18 }}>
        <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity size={16} /> Aktivitas 7 Hari Terakhir
        </h3>
        {usage?.series ? <UsageBars series={usage.series} /> : <p className="text-muted" style={{ fontSize: 13.5 }}>Memuat data...</p>}
      </div>

      <div className="card" style={{ padding: 22, marginTop: 18 }}>
        <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Activity size={16} /> Riwayat Terakhir
        </h3>
        {!usage || usage.recent?.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13.5 }}>Belum ada aktivitas.</p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {usage.recent.slice(0, 10).map((a, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span className="act-dot" />
                <span style={{ flex: 1 }}>{USAGE_LABEL[a.action] || a.action}</span>
                <span className="text-muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{uAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SkillsTab({ addToast }) {
  const SKILLS_LIST = [
    {
      id: 'frontend-design',
      name: 'Frontend Design (Anthropic)',
      desc: 'Panduan desain visual yang berkarakter, berani, spesifik untuk tema aplikasi, dan bernilai seni tinggi (bukan template generik).',
      url: 'https://github.com/anthropics/skills'
    },
    {
      id: 'web-design-guidelines',
      name: 'Web Interface Guidelines (Vercel)',
      desc: 'Standar kualitas kegunaan, aksesibilitas (A11y), performa, serta optimasi tata letak elemen di browser.',
      url: 'https://github.com/vercel-labs/agent-skills'
    },
    {
      id: 'ui-ux-pro-max',
      name: 'UI/UX Pro Max (NextLevelBuilder)',
      desc: 'Sistem desain modern, layout 8dp/4pt, safe areas mobile, kontras Light/Dark mode, performa tinggi, dan interaksi natural.',
      url: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill'
    },
    {
      id: 'vercel-react-best-practices',
      name: 'React Best Practices (Vercel)',
      desc: 'Penyusunan komponen React modular, penggunaan hooks optimal, penanganan state, dan code structure bersih.',
      url: 'https://github.com/vercel-labs/agent-skills/vercel-react-best-practices'
    },
    {
      id: 'framer-motion-animations',
      name: 'Framer Motion Animations (Interactive)',
      desc: 'Animasi transisi mikro, stagger loading, modal fade, hover effects, dan gerak natural yang meningkatkan keaktifan interaksi.',
      url: 'https://github.com/framer/motion'
    },
    {
      id: 'react-performance-optimizer',
      name: 'Performance Optimizer (Next/React)',
      desc: 'Optimasi rendering, memoization strategis, virtualisasi list besar, dan pencegahan layout thrashing.',
      url: 'https://github.com/vercel/next.js'
    }
  ]

  const [activeSkills, setActiveSkills] = useState(() => {
    try {
      const stored = localStorage.getItem('arisehash_active_skills')
      return stored ? JSON.parse(stored) : ['frontend-design', 'web-design-guidelines', 'ui-ux-pro-max', 'vercel-react-best-practices', 'framer-motion-animations', 'react-performance-optimizer']
    } catch {
      return ['frontend-design', 'web-design-guidelines', 'ui-ux-pro-max', 'vercel-react-best-practices', 'framer-motion-animations', 'react-performance-optimizer']
    }
  })

  const [customSkills, setCustomSkills] = useState(() => {
    try {
      const stored = localStorage.getItem('arisehash_custom_skills')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillUrl, setNewSkillUrl] = useState('')
  const [newSkillDesc, setNewSkillDesc] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const saveActive = (next) => {
    setActiveSkills(next)
    localStorage.setItem('arisehash_active_skills', JSON.stringify(next))
  }

  const toggleSkill = (id) => {
    if (activeSkills.includes(id)) {
      saveActive(activeSkills.filter((x) => x !== id))
      addToast('Skill dinonaktifkan.', 'info')
    } else {
      saveActive([...activeSkills, id])
      addToast('Skill diaktifkan.', 'success')
    }
  }

  const handleAddSkill = (e) => {
    e.preventDefault()
    if (!newSkillName.trim() || !newSkillUrl.trim()) {
      addToast('Nama dan URL skill wajib diisi.', 'error')
      return
    }

    const newSkill = {
      id: `custom-${Date.now()}`,
      name: newSkillName.trim(),
      desc: newSkillDesc.trim() || 'Custom user injected skill.',
      url: newSkillUrl.trim(),
      isCustom: true
    }

    const nextCustom = [...customSkills, newSkill]
    setCustomSkills(nextCustom)
    localStorage.setItem('arisehash_custom_skills', JSON.stringify(nextCustom))

    // Automatically enable it
    saveActive([...activeSkills, newSkill.id])

    // Reset form
    setNewSkillName('')
    setNewSkillUrl('')
    setNewSkillDesc('')
    setShowAddForm(false)
    addToast(`Skill "${newSkill.name}" berhasil ditambahkan!`, 'success')
  }

  const handleDeleteCustomSkill = (id, name) => {
    const nextCustom = customSkills.filter((x) => x.id !== id)
    setCustomSkills(nextCustom)
    localStorage.setItem('arisehash_custom_skills', JSON.stringify(nextCustom))

    // Remove from active if present
    saveActive(activeSkills.filter((x) => x !== id))
    addToast(`Skill "${name}" berhasil dihapus.`, 'info')
  }

  const allSkills = [...SKILLS_LIST, ...customSkills]

  return (
    <motion.div {...fadeIn(0.05)} style={{ marginTop: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} /> UI/UX Design & Agent Skills
          </h3>
          {!showAddForm && (
            <button className="pill pill-indigo" style={{ padding: '8px 14px' }} onClick={() => setShowAddForm(true)}>
              + Tambah Skill Custom
            </button>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
          Aktifkan atau tambahkan agen skills untuk memandu generator AI di Build Code dalam menghasilkan 
          desain antarmuka (UI/UX) dan kode berkualitas tinggi yang premium, responsif, dan aksesibel.
        </p>

        {showAddForm && (
          <form onSubmit={handleAddSkill} className="card" style={{ padding: 18, background: 'var(--bg-2)', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label className="settings-label" htmlFor="skill-name">Nama Skill</label>
                <input 
                  id="skill-name"
                  name="skillName"
                  className="input" 
                  autoComplete="off"
                  placeholder="mis. Premium Motion & Transitions" 
                  value={newSkillName} 
                  onChange={(e) => setNewSkillName(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="settings-label" htmlFor="skill-url">URL Repository / Sumber</label>
                <input 
                  id="skill-url"
                  name="skillUrl"
                  type="url"
                  className="input" 
                  autoComplete="url"
                  placeholder="https://github.com/... atau npm command" 
                  value={newSkillUrl} 
                  onChange={(e) => setNewSkillUrl(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="settings-label" htmlFor="skill-description">Deskripsi Singkat</label>
                <textarea 
                  id="skill-description"
                  name="skillDescription"
                  className="input" 
                  style={{ height: 60, padding: '8px 12px', resize: 'vertical' }}
                  placeholder="Panduan bagi agen untuk mengoptimalkan visual, interaksi, atau animasi..." 
                  value={newSkillDesc} 
                  onChange={(e) => setNewSkillDesc(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" className="pill pill-indigo" style={{ padding: '9px 16px' }}>Tambah Skill</button>
                <button type="button" className="pill" onClick={() => setShowAddForm(false)} style={{ padding: '9px 16px' }}>Batal</button>
              </div>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allSkills.map((s) => {
            const isActive = activeSkills.includes(s.id)
            return (
              <div 
                key={s.id} 
                className="card" 
                style={{ 
                  padding: 14, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  flexWrap: 'wrap',
                  borderColor: isActive ? 'var(--indigo-border, rgba(99, 102, 241, 0.3))' : 'var(--line)',
                  background: isActive ? 'rgba(99, 102, 241, 0.02)' : 'transparent',
                }}
              >
                <span className="dash-action-ic" style={{ 
                  width: 38, 
                  height: 38, 
                  borderRadius: 10,
                  background: isActive ? 'var(--indigo, #6366f1)' : 'var(--bg-3)',
                  color: isActive ? '#fff' : 'var(--text)'
                }}>
                  <ShieldCheck size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s.name}
                    {isActive ? (
                      <span className="chip chip-lime" style={{ fontSize: 9.5, padding: '1px 6px' }}>Aktif</span>
                    ) : (
                      <span className="chip" style={{ fontSize: 9.5, padding: '1px 6px', background: 'var(--bg-3)' }}>Nonaktif</span>
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
                    {s.desc}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--indigo, #6366f1)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Source: {s.url}</span>
                  </div>
                </div>
                {s.isCustom && (
                  <button 
                    className="dash-hist-del" 
                    onClick={() => handleDeleteCustomSkill(s.id, s.name)} 
                    title="Hapus skill custom" 
                    aria-label="Hapus skill custom"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className={`pill ${isActive ? '' : 'pill-indigo'}`}
                  onClick={() => toggleSkill(s.id)}
                  aria-pressed={isActive}
                  style={{ padding: '7px 13px', marginLeft: 'auto' }}
                >
                  {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
