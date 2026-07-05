import { useState } from 'react'
import { NavLink, Outlet, Link, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, FolderKanban, Code2, Settings as SettingsIcon,
  LogOut, ArrowLeft, Menu, X, PanelLeftClose, PanelLeft, ShieldCheck, CreditCard, Search, MessageSquare
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import CommandPalette from './CommandPalette.jsx'
import FullscreenLoader from './FullscreenLoader.jsx'

const navItems = [
  { to: '/app', key: 'side.dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/build-project', key: 'side.buildProject', icon: FolderKanban },
  { to: '/app/build-code', key: 'side.buildCode', icon: Code2 },
  { to: '/app/asisten', key: 'side.assistant', icon: MessageSquare },
  { to: '/app/admin', key: 'side.admin', icon: ShieldCheck, adminOnly: true },
  { to: '/app/upgrade', key: 'side.upgrade', icon: CreditCard },
  { to: '/app/settings', key: 'side.settings', icon: SettingsIcon },
]

const COLLAPSE_KEY = 'arisehash_sidebar_collapsed'

export default function DashboardLayout() {
  const { user, ready, logout } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })

  const location = useLocation()
  const isFullHeightPage = location.pathname === '/app/asisten' || location.pathname.startsWith('/app/ide/')

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  if (!ready) {
    return <FullscreenLoader />
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />
  }

  const handleLogout = async () => { await logout(); navigate('/') }

  const SidebarInner = ({ showCollapseBtn = false }) => (
    <>
      <div className="dash-sidebar-top">
        <Link to="/" className="dash-brand" onClick={() => setOpen(false)} title="AriseHash">
          <img src="/logo.png" alt="AriseHash" width="28" height="28" style={{ height: 28 }} />
        </Link>
        {showCollapseBtn && (
          <button className="dash-collapse-btn" onClick={toggleCollapse} aria-label="Ciutkan sidebar" title="Ciutkan sidebar">
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      <nav className="dash-nav">
        <button className="dash-search-trigger" onClick={() => { setOpen(false); window.dispatchEvent(new Event('arisehash:open-cmdk')) }} title="Cari (Ctrl/⌘+K)">
          <Search size={16} /> <span className="dash-nav-label">{t('common.search')}</span>
          <kbd className="dash-search-kbd dash-nav-label">⌘K</kbd>
        </button>
        {navItems.filter((it) => !it.adminOnly || user.role === 'ADMIN').map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) => `dash-nav-item ${isActive ? 'is-active' : ''}`}
            title={t(it.key)}
          >
            <it.icon size={18} />
            <span className="dash-nav-label">{t(it.key)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dash-sidebar-foot">
        <div className="dash-user">
          <span className="dash-avatar">
            {user.picture && (
              <img 
                src={user.picture} 
                alt={user?.name || 'User'} 
                width="38"
                height="38"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                }} 
              />
            )}
            <span style={{ display: user.picture ? 'none' : 'inline' }}>
              {user.initials || 'U'}
            </span>
          </span>
          <div className="dash-user-meta" style={{ minWidth: 0 }}>
            <div className="dash-user-name">{user.name}</div>
            <div className="dash-user-email">{user.email}</div>
          </div>
        </div>
        <Link to="/" className="dash-foot-link" onClick={() => setOpen(false)} title={t('side.backHome')}>
          <ArrowLeft size={16} /> <span className="dash-nav-label">{t('side.backHome')}</span>
        </Link>
        <button className="dash-foot-link" onClick={handleLogout} title={t('nav.logout')}>
          <LogOut size={16} /> <span className="dash-nav-label">{t('nav.logout')}</span>
        </button>
      </div>
    </>
  )

  return (
    <div className={`dash-shell ${collapsed ? 'is-collapsed' : ''}`}>
      {/* Mobile top bar */}
      <div className="dash-mobilebar">
        <button className="dash-menu-btn" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
        <img src="/logo.png" alt="AriseHash" width="26" height="26" style={{ height: 26 }} />
        <div style={{ width: 40 }} />
      </div>

      {/* Desktop sidebar */}
      <aside className="dash-sidebar">
        <SidebarInner showCollapseBtn />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button type="button" className="dash-overlay" aria-label="Tutup menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="dash-sidebar is-mobile"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <button className="dash-drawer-close" onClick={() => setOpen(false)} aria-label="Tutup"><X size={18} /></button>
              <SidebarInner />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <main className={`dash-content ${isFullHeightPage ? 'is-full-height' : ''}`}>
        <Outlet />
      </main>

      <CommandPalette />
    </div>
  )
}
