import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, ScrollText, Activity, BarChart3, Search, ShieldCheck, ShieldOff,
  RefreshCw, ChevronLeft, ChevronRight, Check, X, Key, Plus, Trash2, Wifi, WifiOff, Edit3
} from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import Tabs from '../components/Tabs.jsx'
import StatCard from '../components/StatCard.jsx'
import { fmt } from '../utils/time.js'
import { ADMIN_TABS, PLANS, PROVIDERS } from '../constants.js'

// Map icons for admin tabs (icons kept local since they're presentational)
const TAB_ICONS = {
  users: Users,
  invoices: ScrollText,
  analytics: BarChart3,
  ops: Activity,
  audit: ScrollText,
  ai: Activity,
  keys: Key,
}
const TABS = ADMIN_TABS.map((t) => ({ ...t, icon: TAB_ICONS[t.id] }))

export default function Admin() {
  const { isAdmin, ready } = useAuth()
  const { addToast } = useToast()
  const [tab, setTab] = useState('users')

  if (ready && !isAdmin) return <Navigate to="/app" replace />

  return (
    <div className="dash-page" style={{ maxWidth: 1100 }}>
      <span className="eyebrow">Admin Ops</span>
      <h1 className="display h-md" style={{ marginTop: 8 }}>Kontrol Sistem</h1>
      <p className="text-muted" style={{ fontSize: 15, marginTop: 6 }}>Kelola pengguna, pantau log, dan lihat statistik sistem.</p>

      <div style={{ marginTop: 22 }}>
        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />
      </div>

      <div style={{ marginTop: 22 }}>
        {tab === 'users' && <UsersTab addToast={addToast} />}
        {tab === 'invoices' && <InvoicesTab addToast={addToast} />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'ops' && <ObservabilityTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'ai' && <AiTab />}
        {tab === 'keys' && <AiKeysTab addToast={addToast} />}
      </div>
    </div>
  )
}

function downloadAdminCsv(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/* ---------- Users ---------- */
function UsersTab({ addToast }) {
  const [data, setData] = useState({ users: [], total: 0, page: 1, totalPages: 1 })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.adminUsers({ page, pageSize: 10, q })
      setData(res)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, q, addToast])

  useEffect(() => { load() }, [load])

  const onSearch = (e) => { e.preventDefault(); setPage(1); load() }

  const toggleRole = async (u) => {
    try {
      await api.adminToggleRole(u.id)
      addToast(`Peran ${u.email} diperbarui.`, 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }
  const changePlan = async (u, planType) => {
    try {
      await api.adminUpdateUserSubscription(u.id, planType)
      addToast(`Paket ${u.email} → ${planType}.`, 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }
  const resetQuota = async (u) => {
    try {
      await api.adminResetQuota(u.id)
      addToast(`Kuota ${u.email} di-reset.`, 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }

  return (
    <div>
      <form onSubmit={onSearch} style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input className="input" style={{ paddingLeft: 38, height: 42 }} placeholder="Cari nama atau email..." value={q} onChange={(e) => setQ(e.target.value)} />
      </form>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>Pengguna</th><th>Peran</th><th>Paket</th><th>Kuota Hari Ini</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {data.users.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>{loading ? 'Memuat...' : 'Tidak ada pengguna.'}</td></tr>
            ) : data.users.map((u) => {
              const sub = u.subscriptions?.[0]
              return (
                <tr key={u.id}>
                  <td data-label="Pengguna">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="dash-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {u.picture && (
                          <img 
                            src={u.picture} 
                            alt={u.name || 'User'} 
                            width="32"
                            height="32"
                            onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'inline'; }} 
                          />
                        )}
                        <span style={{ display: u.picture ? 'none' : 'inline' }}>
                          {u.name?.[0] || 'U'}
                        </span>
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Peran"><span className="chip" style={{ fontSize: 10.5 }}>{u.role}</span></td>
                  <td data-label="Paket">
                    <select className="admin-mini-select" value={sub?.planType || 'FREE'} onChange={(e) => changePlan(u, e.target.value)}>
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td data-label="Kuota" style={{ fontSize: 13 }}>{sub ? `${sub.quotaUsedToday} PRD / ${sub.codeQuotaUsedToday} kode` : '—'}</td>
                  <td data-label="Aksi">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-icon-btn" title={u.role === 'ADMIN' ? 'Jadikan USER' : 'Jadikan ADMIN'} aria-label={u.role === 'ADMIN' ? 'Jadikan USER' : 'Jadikan ADMIN'} onClick={() => toggleRole(u)}>
                        {u.role === 'ADMIN' ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                      <button className="admin-icon-btn" title="Reset kuota" aria-label="Reset kuota" onClick={() => resetQuota(u)}><RefreshCw size={15} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span className="text-muted" style={{ fontSize: 13 }}>{data.total} pengguna</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="admin-icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 13 }}>Hal {data.page} / {data.totalPages}</span>
          <button className="admin-icon-btn" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Halaman berikutnya"><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Analytics ---------- */
function AnalyticsTab() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.adminStats().then(setStats).catch(() => {}) }, [])
  if (!stats) return <p className="text-muted" style={{ fontSize: 14 }}>Memuat statistik...</p>

  const cards = [
    { label: 'Total Pengguna', value: stats.totalUsers },
    { label: 'Total Proyek (PRD)', value: stats.totalBlueprints },
    { label: 'Workspace Kode', value: stats.totalProjects },
    { label: 'Request AI', value: stats.aiRequestStats?.total },
    { label: 'AI Sukses', value: stats.aiRequestStats?.success },
    { label: 'AI Gagal', value: stats.aiRequestStats?.fail },
  ]
  return (
    <div>
      <div className="dash-grid">
        {cards.map((c) => (
          <StatCard key={c.label} value={c.value ?? 0} label={c.label} />
        ))}
      </div>
      <div className="card" style={{ padding: 22, marginTop: 18 }}>
        <h3 className="display" style={{ fontSize: 15, marginBottom: 14 }}>Distribusi Paket</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(stats.planStats || {}).map(([plan, count]) => (
            <span key={plan} className="chip" style={{ fontSize: 12 }}>{plan}: {count}</span>
          ))}
          {Object.keys(stats.planStats || {}).length === 0 && <span className="text-muted" style={{ fontSize: 13 }}>Belum ada data.</span>}
        </div>
      </div>
    </div>
  )
}

function ObservabilityTab() {
  const [data, setData] = useState(null)
  useEffect(() => { api.adminObservability().then(setData).catch(() => setData(null)) }, [])
  if (!data) return <p className="text-muted" style={{ fontSize: 14 }}>Memuat observability...</p>
  const cards = [
    { label: 'AI 24 Jam', value: data.ai24h?.total ?? 0 },
    { label: 'AI Success Rate', value: `${data.ai24h?.successRate ?? 100}%` },
    { label: 'Rata-rata Latency AI', value: `${data.avgAiDurationMs || 0} ms` },
    { label: 'Session Aktif', value: data.activeSessions ?? 0 },
    { label: 'Public Code Share', value: data.publicCodeShares ?? 0 },
  ]
  return (
    <div>
      <div className="dash-grid">
        {cards.map((c) => (
          <StatCard key={c.label} value={c.value} label={c.label} />
        ))}
      </div>
      <div className="card" style={{ padding: 22, marginTop: 18 }}>
        <h3 className="display" style={{ fontSize: 15, marginBottom: 14 }}>Error AI Terbaru</h3>
        {data.recentErrors?.length ? (
          <ul style={{ display: 'grid', gap: 10 }}>
            {data.recentErrors.map((e) => (
              <li key={e.id} style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="act-dot" style={{ background: '#b3261e' }} />
                <span style={{ flex: 1 }}>{e.modelUsed} · {e.errorMessage || 'Unknown error'}</span>
                <span className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmt(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted" style={{ fontSize: 13 }}>Tidak ada error terbaru.</p>}
      </div>
    </div>
  )
}

/* ---------- Audit logs ---------- */
function AuditTab() {
  const [logs, setLogs] = useState(null)
  const [filter, setFilter] = useState('')
  useEffect(() => { api.adminAuditLogs(filter).then((res) => setLogs(res?.items || res || [])).catch(() => setLogs([])) }, [filter])
  return (
    <>
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <input className="input" style={{ maxWidth: 260, height: 38 }} placeholder="Filter aksi..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      <button className="pill" style={{ padding: '8px 14px' }} onClick={() => downloadAdminCsv(api.adminAuditCsvUrl())}>Export CSV</button>
    </div>
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="admin-table">
        <thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Detail</th></tr></thead>
        <tbody>
          {logs === null ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Memuat...</td></tr>
          ) : logs.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Belum ada log.</td></tr>
          ) : logs.map((l) => (
            <tr key={l.id}>
              <td data-label="Waktu" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(l.createdAt)}</td>
              <td data-label="Aktor" style={{ fontSize: 12.5 }}>{l.user?.email || '—'}</td>
              <td data-label="Aksi"><span className="chip" style={{ fontSize: 10 }}>{l.action}</span></td>
              <td data-label="Detail" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{l.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

/* ---------- AI logs ---------- */
function AiTab() {
  const [logs, setLogs] = useState(null)
  const [success, setSuccess] = useState('')
  useEffect(() => { api.adminAiLogs(success).then((res) => setLogs(res?.items || res || [])).catch(() => setLogs([])) }, [success])
  return (
    <>
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <select className="input" style={{ maxWidth: 180, height: 38 }} value={success} onChange={(e) => setSuccess(e.target.value)}>
        <option value="">Semua status</option>
        <option value="true">Sukses</option>
        <option value="false">Gagal</option>
      </select>
      <button className="pill" style={{ padding: '8px 14px' }} onClick={() => downloadAdminCsv(api.adminAiCsvUrl())}>Export CSV</button>
    </div>
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="admin-table">
        <thead><tr><th>Waktu</th><th>Pengguna</th><th>Model</th><th>Token</th><th>Status</th></tr></thead>
        <tbody>
          {logs === null ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Memuat...</td></tr>
          ) : logs.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Belum ada log.</td></tr>
          ) : logs.map((l) => (
            <tr key={l.id}>
              <td data-label="Waktu" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(l.createdAt)}</td>
              <td data-label="Pengguna" style={{ fontSize: 12.5 }}>{l.user?.email || '—'}</td>
              <td data-label="Model" style={{ fontSize: 12.5 }}>{l.modelUsed}</td>
              <td data-label="Token" style={{ fontSize: 12.5 }}>{(l.promptTokens || 0) + (l.completionTokens || 0)} · {l.durationMs || 0}ms</td>
              <td data-label="Status">
                <span className="chip" style={{ fontSize: 10, gap: 4 }}>
                  {l.success ? <Check size={11} /> : <X size={11} />} {l.success ? 'OK' : 'Gagal'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

/* ---------- AI Keys Management ---------- */
function AiKeysTab({ addToast }) {
  const confirm = useConfirm()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [testing, setTesting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.adminAiKeys()
      setKeys(res || [])
    } catch (err) { addToast(err.message, 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const onDelete = async (id) => {
    if (!(await confirm({ title: 'Hapus API Key', message: 'Hapus API key ini?', danger: true, confirmText: 'Hapus' }))) return
    try {
      await api.deleteAdminAiKey(id)
      addToast('Key dihapus.', 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }

  const onTest = async (id) => {
    setTesting(id)
    try {
      const res = await api.testAdminAiKey(id)
      addToast(`Koneksi OK: ${res.message || 'Berhasil'}`, 'success')
    } catch (err) { addToast(`Gagal: ${err.message}`, 'error') }
    finally { setTesting(null) }
  }

  const onToggleActive = async (key) => {
    try {
      await api.updateAdminAiKey(key.id, { isActive: !key.isActive })
      addToast(`Key ${key.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`, 'success')
      load()
    } catch (err) { addToast(err.message, 'error') }
  }

  const onSave = () => {
    setShowForm(false)
    setEditing(null)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Kelola API key AI dari berbagai provider. Key aktif digunakan sebagai prioritas sebelum env var.</p>
        <button className="pill primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }} onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus size={14} /> Tambah Key
        </button>
      </div>

      {showForm && <AiKeyForm editing={editing} onSave={onSave} onCancel={() => { setShowForm(false); setEditing(null) }} addToast={addToast} />}

      <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: showForm ? 16 : 0 }}>
        <table className="admin-table">
          <thead>
            <tr><th>Label</th><th>Provider</th><th>Model</th><th>Status</th><th>Request</th><th>Token</th><th>Terakhir</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>Memuat...</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>Belum ada API key.</td></tr>
            ) : keys.map((k) => (
              <tr key={k.id}>
                <td data-label="Label" style={{ fontWeight: 600, fontSize: 13 }}>{k.label}</td>
                <td data-label="Provider"><span className="chip" style={{ fontSize: 10.5 }}>{k.provider}</span></td>
                <td data-label="Model" style={{ fontSize: 12.5 }}>{k.model}</td>
                <td data-label="Status">
                  <button onClick={() => onToggleActive(k)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                    <span className="chip" style={{ fontSize: 10.5, background: k.isActive ? 'var(--green-bg, #dcfce7)' : 'var(--red-bg, #fee2e2)', color: k.isActive ? 'var(--green, #16a34a)' : 'var(--red, #dc2626)' }}>
                      {k.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </button>
                </td>
                <td data-label="Request" style={{ fontSize: 13 }}>{k.totalRequests}</td>
                <td data-label="Token" style={{ fontSize: 13 }}>{(k.totalTokens || 0).toLocaleString()}</td>
                <td data-label="Terakhir" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{k.lastUsedAt ? fmt(k.lastUsedAt) : '—'}</td>
                <td data-label="Aksi">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="admin-icon-btn" title="Tes koneksi" aria-label="Tes koneksi" onClick={() => onTest(k.id)} disabled={testing === k.id}>
                      {testing === k.id ? <RefreshCw size={15} className="spin" /> : <Wifi size={15} />}
                    </button>
                    <button className="admin-icon-btn" title="Edit" aria-label="Edit API key" onClick={() => { setEditing(k); setShowForm(true) }}>
                      <Edit3 size={15} />
                    </button>
                    <button className="admin-icon-btn" title="Hapus" aria-label="Hapus API key" onClick={() => onDelete(k.id)} style={{ color: 'var(--red, #dc2626)' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AiKeyForm({ editing, onSave, onCancel, addToast }) {
  const [form, setForm] = useState({
    provider: editing?.provider || 'openai',
    label: editing?.label || '',
    baseUrl: editing?.baseUrl || '',
    apiKey: '',
    model: editing?.model || '',
    isActive: editing?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testingConn, setTestingConn] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const providerDefaults = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    custom: '',
  }

  const onProviderChange = (e) => {
    const p = e.target.value
    setForm((f) => ({ ...f, provider: p, baseUrl: providerDefaults[p] || f.baseUrl }))
  }

  const onTestConnection = async () => {
    setTestingConn(true)
    setTestResult(null)
    try {
      const res = await api.testAdminAiConnection({ baseUrl: form.baseUrl, apiKey: form.apiKey, model: form.model, provider: form.provider })
      setTestResult({ ok: true, msg: res.message || 'Koneksi berhasil!' })
    } catch (err) {
      setTestResult({ ok: false, msg: err.message })
    } finally { setTestingConn(false) }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const payload = { ...form }
        if (!payload.apiKey) delete payload.apiKey
        await api.updateAdminAiKey(editing.id, payload)
        addToast('Key diperbarui.', 'success')
      } else {
        await api.createAdminAiKey(form)
        addToast('Key ditambahkan.', 'success')
      }
      onSave()
    } catch (err) { addToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ padding: 22 }}>
      <h3 className="display" style={{ fontSize: 15, marginBottom: 16 }}>{editing ? 'Ubah API Key' : 'Tambah API Key Baru'}</h3>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Provider</label>
          <select className="input" style={{ height: 38 }} value={form.provider} onChange={onProviderChange}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Label</label>
          <input className="input" style={{ height: 38 }} value={form.label} onChange={set('label')} placeholder="Contoh: OpenAI Production" required />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Base URL</label>
          <input className="input" style={{ height: 38 }} value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://api.openai.com/v1" required />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>API Key {editing && <span className="text-muted">(kosongkan jika tidak diubah)</span>}</label>
          <input className="input" style={{ height: 38 }} type="password" value={form.apiKey} onChange={set('apiKey')} placeholder={editing ? '••••••••' : 'sk-...'} required={!editing} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Model</label>
          <input className="input" style={{ height: 38 }} value={form.model} onChange={set('model')} placeholder="gpt-4o-mini" required />
        </div>
        {testResult && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: testResult.ok ? 'var(--green-bg, #dcfce7)' : 'var(--red-bg, #fee2e2)', color: testResult.ok ? 'var(--green, #16a34a)' : 'var(--red, #dc2626)' }}>
            {testResult.ok ? <Check size={14} style={{ verticalAlign: -2 }} /> : <WifiOff size={14} style={{ verticalAlign: -2 }} />} {testResult.msg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="pill primary" style={{ padding: '8px 18px' }} disabled={saving}>
            {saving ? 'Menyimpan...' : editing ? 'Perbarui' : 'Simpan'}
          </button>
          <button type="button" className="pill" style={{ padding: '8px 18px' }} onClick={onTestConnection} disabled={testingConn || !form.baseUrl || !form.model || (!form.apiKey && !editing)}>
            {testingConn ? 'Menguji...' : 'Tes Koneksi'}
          </button>
          <button type="button" className="pill" style={{ padding: '8px 18px' }} onClick={onCancel}>Batal</button>
        </div>
      </form>
    </div>
  )
}

function InvoicesTab({ addToast }) {
  const [data, setData] = useState({ invoices: [], total: 0, page: 1, totalPages: 1 })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.adminInvoices({ page, pageSize: 10, q })
      setData(res)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, q, addToast])

  useEffect(() => { load() }, [load])

  const onSearch = (e) => { e.preventDefault(); setPage(1); load() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <form onSubmit={onSearch} style={{ position: 'relative', maxWidth: 320, width: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 38, height: 42 }} placeholder="Cari nomor invoice, nama, email..." value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nomor Invoice</th>
              <th>Pengguna</th>
              <th>Plan</th>
              <th>Jumlah</th>
              <th>Tanggal Rilis</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.invoices.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>{loading ? 'Memuat...' : 'Tidak ada invoice.'}</td></tr>
            ) : data.invoices.map((inv) => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 600, color: 'var(--green, #c5f82a)' }}>{inv.invoiceNumber}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{inv.user?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{inv.user?.email}</div>
                </td>
                <td><span className="badge">{inv.planType}</span></td>
                <td style={{ fontWeight: 600 }}>Rp {inv.amount.toLocaleString('id-ID')}</td>
                <td>{fmt(inv.issuedAt)}</td>
                <td>
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    {inv.status}
                  </span>
                </td>
                <td>
                  <button className="pill small primary" onClick={() => setSelectedInvoice(inv)}>Cetak</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button className="pill" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
          <span style={{ alignSelf: 'center', fontSize: 14 }}>Halaman {page} dari {data.totalPages}</span>
          <button className="pill" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Invoice Modal Overlay */}
      {selectedInvoice && (
        <div className="modal-backdrop" style={{ zIndex: 100000, position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.55)' }}>
          <button type="button" onClick={() => setSelectedInvoice(null)} aria-label="Tutup invoice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'default' }} />
          <div className="modal-content" style={{ position: 'relative', maxWidth: 640, width: '90%', padding: 32, background: '#18181b', color: '#f4f4f5' }} id="print-invoice-modal">
            {/* Printable Styling */}
            <style>{`
              @media print {
                body * { display: none !important; }
                #print-invoice-modal, #print-invoice-modal * { display: block !important; }
                #print-invoice-modal { position: absolute; left: 0; top: 0; width: 100%; background: #ffffff !important; color: #000000 !important; border: none !important; padding: 0 !important; box-shadow: none !important; }
                .no-print { display: none !important; }
                .print-logo { filter: brightness(0) !important; }
              }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #3f3f46', paddingBottom: 18, marginBottom: 18 }}>
              <div>
                <img src="/logo.png" alt="AriseHash" className="print-logo" width="28" height="28" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Automated Web App Prototyping Platform</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: 20, color: 'var(--green, #c5f82a)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice</h3>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{selectedInvoice.invoiceNumber}</div>
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ditagihkan Kepada</span>
                <strong style={{ display: 'block', marginTop: 4, fontSize: 14 }}>{selectedInvoice.user?.name}</strong>
                <span style={{ color: 'var(--muted)' }}>{selectedInvoice.user?.email}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detail Tagihan</span>
                <div style={{ marginTop: 4 }}>Tanggal: <strong>{new Date(selectedInvoice.issuedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
                <div>Status: <span style={{ color: '#10b981', fontWeight: 700 }}>{selectedInvoice.status}</span></div>
              </div>
            </div>

            {/* Itemized Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #3f3f46', textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={{ padding: '8px 0' }}>Deskripsi Layanan</th>
                  <th style={{ padding: '8px 0', textAlign: 'center' }}>Jumlah</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Harga Satuan</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '12px 0' }}>
                    <strong>Langganan Paket {selectedInvoice.planType} AriseHash</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Akses penuh ke model AI premium prioritas tinggi, BYOK, dan multi-page workspace.</div>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center' }}>1 Bulan</td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>Rp {selectedInvoice.amount.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>Rp {selectedInvoice.amount.toLocaleString('id-ID')}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  <td colSpan={2}></td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--muted)' }}>Subtotal</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>Rp {selectedInvoice.amount.toLocaleString('id-ID')}</td>
                </tr>
                <tr style={{ fontSize: 15, fontWeight: 700 }}>
                  <td colSpan={2}></td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--green, #c5f82a)' }}>Total Bayar</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: 'var(--green, #c5f82a)' }}>Rp {selectedInvoice.amount.toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer Notice */}
            <div style={{ fontSize: 11, color: 'var(--muted)', borderTop: '1px solid #27272a', paddingTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
              Pembayaran lunas diterima pada {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString('id-ID') : 'tanggal belum tersedia'}.<br />
              Dokumen ini sah sebagai tanda bukti pembayaran elektronik resmi dari AriseHash.
            </div>

            {/* Action Buttons */}
            <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="pill primary" onClick={() => window.print()}>Cetak Invoice</button>
              <button className="pill" onClick={() => setSelectedInvoice(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
