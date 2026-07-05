import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FolderKanban, Code2, MessageSquare, FileText, ArrowUpRight, CreditCard, Zap,
  Trash2, ExternalLink, Activity, DollarSign,
  Check, Circle, Rocket, Hand
} from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { useLang, useT } from '../context/LanguageContext.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { timeAgo, ACTIVITY_LABEL } from '../utils/time.js'
import { fadeIn } from '../utils/framer.js'
import { PLAN_LABELS } from '../constants.js'

function buildSeries(items, days = 14) {
  const buckets = new Array(days).fill(0)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  items.forEach((it) => {
    const d = new Date(it.createdAt || it.updatedAt); d.setHours(0, 0, 0, 0)
    const diff = Math.round((now - d) / 86400000)
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1
  })
  return buckets
}

function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return d
}

function ActivityChart({ series, height = 200 }) {
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null) // { i, x, y, v }
  const W = 640, H = height, padL = 8, padR = 8, padT = 16, padB = 22
  const max = Math.max(1, ...series)
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const stepX = innerW / (series.length - 1)
  const pts = series.map((v, i) => [padL + i * stepX, padT + innerH - (v / max) * innerH])
  const line = smoothPath(pts)
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${padT + innerH} L${pts[0][0].toFixed(1)},${padT + innerH} Z`
  const yTicks = 4

  const onMove = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let i = Math.round((x - padL) / stepX)
    i = Math.max(0, Math.min(series.length - 1, i))
    setHover({ i, x: pts[i][0], y: pts[i][1], v: series[i] })
  }
  const dayLabel = (offset) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="dash-chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg" role="img" aria-label="Aktivitas 14 hari"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        {/* horizontal grid + y labels */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + (innerH / yTicks) * i
          const val = Math.round(max - (max / yTicks) * i)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} className="dash-chart-grid" />
              <text x={padL + 2} y={y - 3} className="dash-chart-axis">{val}</text>
            </g>
          )
        })}
        {/* area + line */}
        <path d={area} fill="url(#chartFill)" className="dash-chart-area" />
        <path d={line} fill="none" stroke="url(#chartLine)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" className="dash-chart-line" />
        {/* baseline axis labels: setiap 2 hari */}
        {series.map((_, i) => {
          if (i % 3 !== 0 && i !== series.length - 1) return null
          return (
            <text key={i} x={pts[i][0]} y={H - 6} textAnchor="middle" className="dash-chart-axis">{dayLabel(series.length - 1 - i)}</text>
          )
        })}
        {/* hover: guide line + dot */}
        {hover && (
          <g>
            <line x1={hover.x} y1={padT} x2={hover.x} y2={padT + innerH} className="dash-chart-guide" />
            <circle cx={hover.x} cy={hover.y} r="5.5" fill="var(--bg)" stroke="var(--accent-2)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="dash-chart-tip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}>
          <span className="dash-chart-tip-val">{hover.v}</span>
          <span className="dash-chart-tip-lbl">{dayLabel(series.length - 1 - hover.i)}</span>
        </div>
      )}
    </div>
  )
}

function QuotaRing({ used, total, label }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const r = 30, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 90 ? '#dc2626' : pct >= 70 ? '#f59e0b' : 'var(--indigo, #6366f1)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={76} height={76} viewBox="0 0 76 76">
        <circle cx={38} cy={38} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={5} />
        <circle cx={38} cy={38} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset .5s ease' }} />
        <text x={38} y={36} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: 'var(--ink)' }}>{used}/{total}</text>
        <text x={38} y={49} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--muted)' }}>{label}</text>
      </svg>
    </div>
  )
}

const COST_COLORS = ['#7c74ff', '#f472b6', '#38bdf8', '#34d399', '#fbbf24', '#9aa0aa']
const fmtUSD = (n) => n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`
const fmtTokens = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`

function TokenCostDonut({ cost }) {
  const total = cost?.total || 0
  const items = (cost?.breakdown || []).filter((d) => d.cost > 0)
  const r = 54, sw = 18, c = 2 * Math.PI * r

  if (total <= 0) {
    return (
      <div className="cost-donut-empty">
        <DollarSign size={26} className="text-muted" />
        <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>Belum ada pemakaian token berbayar dalam 30 hari terakhir.</p>
      </div>
    )
  }

  let acc = 0
  const segs = items.map((d, i) => {
    const frac = d.cost / total
    const seg = { ...d, color: COST_COLORS[i % COST_COLORS.length], len: frac * c, off: -acc * c }
    acc += frac
    return seg
  })

  return (
    <div className="cost-donut-wrap">
      <div className="cost-donut-ring">
        <svg width={150} height={150} viewBox="0 0 150 150" role="img" aria-label={`Total biaya token ${fmtUSD(total)}`}>
          <circle cx={75} cy={75} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={sw} />
          {segs.map((s, i) => (
            <circle key={i} cx={75} cy={75} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${s.len.toFixed(2)} ${(c - s.len).toFixed(2)}`} strokeDashoffset={s.off.toFixed(2)}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray .6s ease' }} />
          ))}
          <text x={75} y={72} textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, fill: 'var(--ink)' }}>{fmtUSD(total)}</text>
          <text x={75} y={90} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--muted)' }}>30 hari</text>
        </svg>
      </div>
      <ul className="cost-legend">
        {segs.map((s, i) => (
          <li key={i} className="cost-legend-row">
            <span className="cost-legend-dot" style={{ background: s.color }} />
            <span className="cost-legend-label" title={s.label}>{s.label}</span>
            <span className="cost-legend-val">{fmtUSD(s.cost)}</span>
          </li>
        ))}
      </ul>
      <div className="cost-foot text-muted">{fmtTokens(cost.totalTokens || 0)} token · {cost.requests || 0} permintaan</div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const { addToast } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState(null)
  const [blueprints, setBlueprints] = useState([])
  const [codeProjects, setCodeProjects] = useState([])
  const [chats, setChats] = useState([])
  const [usage, setUsage] = useState(null)


  const load = () => {
    setLoading(true)
    Promise.allSettled([api.quota(), api.blueprints(), api.codeProjects(), api.chats(), api.usage()]).then(([q, b, c, ch, u]) => {
      if (q.status === 'fulfilled') setQuota(q.value)
      if (b.status === 'fulfilled') setBlueprints(b.value?.items || b.value || [])
      if (c.status === 'fulfilled') setCodeProjects(c.value?.items || c.value || [])
      if (ch.status === 'fulfilled') setChats(ch.value?.items || ch.value || [])
      if (u.status === 'fulfilled') setUsage(u.value)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])



  const firstName = user?.name?.split(' ')[0] || 'Sobat'
  const series = useMemo(() => buildSeries([...blueprints, ...codeProjects, ...chats]), [blueprints, codeProjects, chats])
  const totalActivity = series.reduce((a, b) => a + b, 0)

  // Onboarding checklist
  const steps = [
    { done: blueprints.length > 0, label: t('dash.checklist.1'), to: '/app/build-project' },
    { done: codeProjects.length > 0, label: t('dash.checklist.2'), to: '/app/build-code' },
    { done: chats.length > 0, label: t('dash.checklist.3'), to: '/app/asisten' },
  ]
  const allDone = steps.every((s) => s.done)

  const deleteBlueprint = async (id, e) => {
    e?.stopPropagation()
    const ok = await confirm({ title: t('dash.delete.confirm.title'), message: t('dash.delete.confirm.msg'), danger: true, confirmText: t('dash.activity.btn.delete') })
    if (!ok) return
    try {
      await api.deleteBlueprint(id)
      setBlueprints((prev) => prev.filter((b) => b.id !== id))
      addToast(t('dash.delete.toast'), 'success')
    } catch (err) { addToast(err.message, 'error') }
  }

  return (
    <div className="dash-page">
      <motion.div {...fadeIn(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">{t('dash.eyebrow')}</span>
          <h1 className="display h-md" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>{t('dash.hello')}, {firstName} <Hand size={24} className="dash-wave" strokeWidth={2.2} /></h1>
          <p className="text-muted" style={{ fontSize: 15, marginTop: 6 }}>{t('dash.sub')}</p>
        </div>

      </motion.div>

      {/* Stat cards */}
      {loading ? (
        <div className="dash-grid" style={{ marginTop: 26 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="dash-grid" style={{ marginTop: 26 }}>
          <motion.div {...fadeIn(0.04)}>
            <BorderGlowCard borderRadius={20} glowRadius={20} innerClassName="dash-stat" innerStyle={{ borderRadius: 20 }}>
              <span className="dash-stat-ic"><FileText size={20} color="var(--on-ink)" /></span>
              <div><div className="dash-stat-val">{blueprints.length}</div><div className="dash-stat-label">{t('dash.stat.total')}</div></div>
            </BorderGlowCard>
          </motion.div>
          <motion.div {...fadeIn(0.08)}>
            <BorderGlowCard borderRadius={20} glowRadius={20} innerClassName="dash-stat" innerStyle={{ borderRadius: 20 }}>
              <span className="dash-stat-ic"><Code2 size={20} color="var(--on-ink)" /></span>
              <div><div className="dash-stat-val">{codeProjects.length}</div><div className="dash-stat-label">{t('dash.stat.workspaces')}</div></div>
            </BorderGlowCard>
          </motion.div>
          <motion.div {...fadeIn(0.12)}>
            <BorderGlowCard borderRadius={20} glowRadius={20} innerClassName="dash-stat" innerStyle={{ borderRadius: 20 }}>
              <span className="dash-stat-ic"><Zap size={20} color="var(--on-ink)" /></span>
              <div><div className="dash-stat-val">{quota ? `${Math.max(0, quota.codeQuota - quota.codeQuotaUsedToday)} / ${quota.codeQuota}` : '—'}</div><div className="dash-stat-label">{t('dash.stat.credits')}</div></div>
            </BorderGlowCard>
          </motion.div>
          <motion.div {...fadeIn(0.16)}>
            <BorderGlowCard borderRadius={20} glowRadius={20} innerClassName="dash-stat" innerStyle={{ borderRadius: 20 }}>
              <span className="dash-stat-ic"><CreditCard size={20} color="var(--on-ink)" /></span>
              <div><div className="dash-stat-val">{quota?.planType ? (PLAN_LABELS[quota.planType.toUpperCase()] || quota.planType) : 'Gratis'}</div><div className="dash-stat-label">{t('footer.warranty')}</div></div>
            </BorderGlowCard>
          </motion.div>
        </div>
      )}

      {/* Onboarding checklist (until all done) */}
      {!loading && !allDone && (
        <motion.div {...fadeIn(0.18)} style={{ marginTop: 18 }}>
          <BorderGlowCard borderRadius={20} innerClassName="onboard" innerStyle={{ borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Rocket size={16} /> <h3 className="display" style={{ fontSize: 15 }}>{t('dash.checklist.title')}</h3>
            </div>
            <div className="onboard-steps">
              {steps.map((s) => (
                <button key={s.label} className="onboard-step" onClick={() => navigate(s.to)}>
                  <span className={`onboard-check ${s.done ? 'is-done' : ''}`}>{s.done ? <Check size={13} strokeWidth={3} /> : <Circle size={9} />}</span>
                  <span style={{ textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }}>{s.label}</span>
                  {!s.done && <ArrowUpRight size={15} className="text-muted" style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          </BorderGlowCard>
        </motion.div>
      )}

      {/* Activity chart + token cost analytics */}
      <div className="dash-analytics" style={{ marginTop: 18 }}>
        <motion.div {...fadeIn(0.2)} style={{ minWidth: 0 }}>
          <BorderGlowCard borderRadius={20} style={{ height: '100%' }} innerStyle={{ borderRadius: 20, padding: 20, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 className="display" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={15} /> {t('dash.activity.title')}</h3>
              <span className="chip" style={{ fontSize: 11 }}>{totalActivity} aktivitas</span>
            </div>
            <div className="dash-chart"><ActivityChart series={series} height={150} /></div>
          </BorderGlowCard>
        </motion.div>
        <motion.div {...fadeIn(0.24)} style={{ minWidth: 0 }}>
          <BorderGlowCard borderRadius={20} style={{ height: '100%' }} innerStyle={{ borderRadius: 20, padding: 20, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 className="display" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign size={15} /> {t('dash.analytics.cost')}</h3>
              <span className="chip" style={{ fontSize: 11 }}>USD · 30 hari</span>
            </div>
            <TokenCostDonut cost={usage?.cost} />
          </BorderGlowCard>
        </motion.div>
      </div>

      {/* Quick actions */}
      <div className="dash-grid" style={{ marginTop: 18 }}>
        <motion.div {...fadeIn(0.24)}>
          <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20 }}>
            <Link to="/app/build-project" className="dash-action" style={{ borderRadius: 20 }}>
              <span className="dash-action-ic"><FolderKanban size={22} /></span>
              <div style={{ flex: 1 }}><h3 className="display" style={{ fontSize: 17 }}>{t('side.buildProject')}</h3>
                <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>{t('dash.shortcuts.project')}</p></div>
              <ArrowUpRight size={18} className="text-muted" />
            </Link>
          </BorderGlowCard>
        </motion.div>
        <motion.div {...fadeIn(0.28)}>
          <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20 }}>
            <Link to="/app/build-code" className="dash-action" style={{ borderRadius: 20 }}>
              <span className="dash-action-ic"><MessageSquare size={22} /></span>
              <div style={{ flex: 1 }}><h3 className="display" style={{ fontSize: 17 }}>{t('side.buildCode')}</h3>
                <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>{t('dash.shortcuts.assistant')}</p></div>
              <ArrowUpRight size={18} className="text-muted" />
            </Link>
          </BorderGlowCard>
        </motion.div>
      </div>

      {/* History + Right Panel */}
      <div className="dash-grid-3" style={{ marginTop: 26 }}>
        <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={16} /> {t('dash.shortcuts.project')}</h3>
            <Link to="/app/build-project" className="btn-link" style={{ fontSize: 13, borderBottomWidth: 1 }}>{t('dash.activity.btn.view')}</Link>
          </div>
          {blueprints.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13.5 }}>{t('dash.activity.empty')}</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {blueprints.slice(0, 5).map((b) => (
                <li key={b.id} className="dash-hist-row">
                  <Link to="/app/build-project" className="dash-list-item" style={{ flex: 1 }}>
                    <FileText size={14} /> <span className="dash-list-title">{b.name}</span>
                  </Link>
                  <button className="dash-hist-del" onClick={(e) => deleteBlueprint(b.id, e)} title={t('dash.activity.btn.delete')} aria-label={t('dash.activity.btn.delete')}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </BorderGlowCard>

        <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 className="display" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} /> {t('dash.activity.title')}</h3>
          </div>
          {!usage || usage.recent?.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13.5 }}>{t('dash.activity.empty')}</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {usage.recent.slice(0, 5).map((a, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span className="act-dot" />
                  <span style={{ flex: 1 }}>{ACTIVITY_LABEL[a.action] || a.action}</span>
                  <span className="text-muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </BorderGlowCard>

        {/* Right Panel — Chats, Quota Ring, Tips */}
        <div className="dash-side-panel">
          <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 className="display" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><MessageSquare size={15} /> {t('dash.shortcuts.assistant')}</h3>
              <Link to="/app/asisten" className="btn-link" style={{ fontSize: 12 }}>{t('dash.activity.btn.view')}</Link>
            </div>
            {chats.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>{t('dash.activity.empty')}</p>
            ) : (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chats.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="dash-list-item"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 8px' }}
                      onClick={() => navigate(`/app/asisten?id=${c.id}`)}
                    >
                      <MessageSquare size={13} className="text-muted" />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <span className="text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{timeAgo(c.updatedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </BorderGlowCard>

          {quota && (
            <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20, padding: 18 }}>
              <h3 className="display" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><Zap size={15} /> {t('dash.analytics.quota')}</h3>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <QuotaRing used={quota.quotaUsedToday || 0} total={quota.prdQuota || 3} label="PRD" />
                <QuotaRing used={quota.codeQuotaUsedToday || 0} total={quota.codeQuota || 100} label="Kredit" />
              </div>
            </BorderGlowCard>
          )}

          <BorderGlowCard borderRadius={20} innerStyle={{ borderRadius: 20, padding: 18 }}>
            <h3 className="display" style={{ fontSize: 14, marginBottom: 10 }}>{t('dash.tips.title')}</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
              <li><strong>Ctrl+Enter</strong> {t('dash.tips.1')}</li>
              <li><strong>Ctrl+K</strong> {t('dash.tips.2')}</li>
            </ul>
          </BorderGlowCard>
        </div>
      </div>
    </div>
  )
}
