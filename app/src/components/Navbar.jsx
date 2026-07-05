import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogIn, LayoutDashboard, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

const links = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/tentang', key: 'nav.about' },
  { to: '/cara-kerja', key: 'nav.how' },
  { to: '/harga', key: 'nav.pricing' },
]

/* A single pill nav item with a hover "fill" circle that rises from the bottom
   (reactbits PillNav effect, ported to CSS + framer-motion). */
function Pill({ to, end, label }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `pn-pill ${isActive ? 'is-active' : ''}`}>
      <span className="pn-circle" aria-hidden="true" />
      <span className="pn-label-stack">
        <span className="pn-label">{label}</span>
        <span className="pn-label-hover" aria-hidden="true">{label}</span>
      </span>
    </NavLink>
  )
}

export default function Navbar() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`pn-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container pn-inner">
        {/* logo */}
        <Link to="/" className="pn-logo" onClick={() => setOpen(false)} aria-label="AriseHash">
          <img src="/logo.png" alt="AriseHash" width="28" height="28" />
        </Link>

        {/* desktop pill cluster */}
        <nav className="pn-items" aria-label="Navigasi utama">
          <ul className="pn-list">
            {links.map((l) => (
              <li key={l.to}><Pill to={l.to} end={l.end} label={t(l.key)} /></li>
            ))}
          </ul>
        </nav>

        {/* right controls */}
        <div className="pn-right">
          <LanguageSwitcher />
          {user ? (
            <Link to="/app" className="pn-cta">
              <LayoutDashboard size={16} strokeWidth={2.2} />
              <span className="cart-label">{t('nav.dashboard')}</span>
            </Link>
          ) : (
            <Link to="/login" className="pn-cta">
              <LogIn size={16} strokeWidth={2.2} />
              <span className="cart-label">{t('nav.login')}</span>
            </Link>
          )}
          <button className="pn-burger" onClick={() => setOpen((o) => !o)} aria-label="Buka menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button type="button" className="nav-overlay" aria-label="Tutup menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setOpen(false)} />
            <motion.nav
              className="pn-mobile"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                  className={({ isActive }) => `pn-mobile-link ${isActive ? 'is-active' : ''}`}>
                  {t(l.key)}
                </NavLink>
              ))}
              <button className="pn-cta pn-mobile-cta" onClick={() => { setOpen(false); navigate(user ? '/app' : '/login') }}>
                {user ? t('nav.dashboard') : t('nav.login')}
                <ArrowUpRight size={16} strokeWidth={2.4} />
              </button>
              <div className="pn-mobile-foot">
                <LanguageSwitcher variant="mobile" />
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
