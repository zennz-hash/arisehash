import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Home } from 'lucide-react'
import { useLang } from '../context/LanguageContext.jsx'

export default function NotFound() {
  const { t } = useLang()
  return (
    <div className="container section" style={{ textAlign: 'center', maxWidth: 560, paddingTop: 80, paddingBottom: 100 }}>
      <h1 className="display" style={{ fontSize: 'clamp(3rem, 12vw, 6rem)', lineHeight: 1 }}>404</h1>
      <h2 className="display h-md" style={{ marginTop: 8 }}>{t('notfound.title')}</h2>
      <p className="text-muted" style={{ marginTop: 12 }}>
        {t('notfound.text')}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
        <Link to="/" className="pill pill-indigo">
          <Home size={16} /> {t('common.home')}
        </Link>
        <Link to="/harga" className="pill">
          {t('nav.pricing')} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
        </Link>
      </div>
    </div>
  )
}
