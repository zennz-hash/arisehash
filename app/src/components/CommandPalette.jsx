import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, LayoutDashboard, FolderKanban, Code2, Settings as SettingsIcon,
  CreditCard, FileText, CornerDownLeft, Command, MessageSquare
} from 'lucide-react'
import { api } from '../api.js'

const NAV = [
  { label: 'Dasbor', to: '/app', icon: LayoutDashboard, keywords: 'dashboard home beranda' },
  { label: 'Asisten', to: '/app/asisten', icon: MessageSquare, keywords: 'chat asisten ai percakapan' },
  { label: 'Bangun Proyek', to: '/app/build-project', icon: FolderKanban, keywords: 'prd blueprint project buat' },
  { label: 'Bangun Kode', to: '/app/build-code', icon: Code2, keywords: 'code chat ide ai' },
  { label: 'Pengaturan', to: '/app/settings', icon: SettingsIcon, keywords: 'settings akun profil' },
  { label: 'Upgrade Paket', to: '/app/upgrade', icon: CreditCard, keywords: 'pricing harga langganan' },
]

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [projects, setProjects] = useState([])
  const [codeProjects, setCodeProjects] = useState([])
  const inputRef = useRef(null)

  // Global hotkey: Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false); setHelp(false)
      } else if (e.key === '?' && !/input|textarea/i.test(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault(); setHelp((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    const openEvt = () => setOpen(true)
    window.addEventListener('arisehash:open-cmdk', openEvt)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('arisehash:open-cmdk', openEvt) }
  }, [])

  // Load blueprints lazily when first opened.
  useEffect(() => {
    if (open && projects.length === 0) {
      api.blueprints().then((res) => setProjects(res?.items || res || [])).catch(() => {})
      api.codeProjects().then((res) => setCodeProjects(res?.items || res || [])).catch(() => {})
    }
    if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open]) // eslint-disable-line

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const navItems = NAV
      .filter((n) => !term || n.label.toLowerCase().includes(term) || n.keywords.includes(term))
      .map((n) => ({ type: 'nav', ...n }))
    const projItems = projects
      .filter((p) => !term || p.name.toLowerCase().includes(term) || String(p.content || '').toLowerCase().includes(term))
      .slice(0, 6)
      .map((p) => ({ type: 'project', label: p.name, id: p.id, icon: FileText, match: term && String(p.content || '').toLowerCase().includes(term) ? 'Isi PRD' : 'Proyek' }))
    const codeItems = codeProjects
      .filter((p) => !term || p.name.toLowerCase().includes(term))
      .slice(0, 6)
      .map((p) => ({ type: 'code', label: p.name, id: p.id, icon: Code2 }))
    return [...navItems, ...projItems, ...codeItems]
  }, [q, projects, codeProjects])

  useEffect(() => { if (sel >= results.length) setSel(0) }, [results, sel])

  const go = useCallback((item) => {
    setOpen(false)
    if (item.type === 'nav') navigate(item.to)
    else if (item.type === 'code') navigate(`/app/ide/${item.id}`)
    else navigate('/app/build-project', { state: { openBlueprintId: item.id } })
  }, [navigate])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); go(results[sel]) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="cmdk-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="cmdk-dismiss" aria-label="Tutup pencarian cepat" onClick={() => setOpen(false)} />
          <motion.div
            className="cmdk"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            role="dialog" aria-modal="true"
          >
            <div className="cmdk-input">
              <Search size={17} className="text-muted" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Cari halaman atau proyek..." aria-label="Pencarian cepat" />
              <kbd className="cmdk-kbd">ESC</kbd>
            </div>
            <div className="cmdk-list">
              {results.length === 0 ? (
                <div className="cmdk-empty">Tidak ada hasil.</div>
              ) : results.map((item, i) => (
                <button
                  key={`${item.type}-${item.to || item.id}`}
                  className={`cmdk-item ${i === sel ? 'is-sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(item)}
                >
                  <item.icon size={16} />
                  <span className="cmdk-item-label">{item.label}</span>
                  <span className="cmdk-item-type">{item.type === 'nav' ? 'Halaman' : item.type === 'code' ? 'Kode' : item.match || 'Proyek'}</span>
                  {i === sel && <CornerDownLeft size={14} className="text-muted" />}
                </button>
              ))}
            </div>
            <div className="cmdk-foot">
              <span><Command size={12} /> K untuk buka</span>
              <span>↑↓ pilih · ↵ buka · esc tutup</span>
            </div>
          </motion.div>
        </motion.div>
      )}
      {help && (
        <motion.div className="cmdk-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="cmdk-dismiss" aria-label="Tutup bantuan pintasan" onClick={() => setHelp(false)} />
          <motion.div className="cmdk shortcuts-card" initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.14 }} role="dialog" aria-modal="true">
            <div className="cmdk-input" style={{ cursor: 'default' }}>
              <Command size={17} className="text-muted" />
              <span style={{ flex: 1, fontWeight: 700, fontFamily: 'var(--font-display)' }}>Pintasan Keyboard</span>
              <kbd className="cmdk-kbd">ESC</kbd>
            </div>
            <div className="shortcuts-list">
              {[
                ['Buka pencarian cepat', ['Ctrl/⌘', 'K']],
                ['Buka bantuan ini', ['?']],
                ['Navigasi hasil', ['↑', '↓']],
                ['Pilih / buka', ['↵']],
                ['Tutup', ['Esc']],
                ['Kirim pesan / generate', ['↵']],
                ['Baris baru di input', ['Shift', '↵']],
              ].map(([label, keys]) => (
                <div key={label} className="shortcut-row">
                  <span>{label}</span>
                  <span className="shortcut-keys">{keys.map((k) => <kbd key={k} className="cmdk-kbd">{k}</kbd>)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
