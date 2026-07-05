import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useLang } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Footer() {
  const { t } = useLang()
  const { user } = useAuth()
  return (
    <footer style={{ background: '#18181b', color: '#f4f4f5', marginTop: 40 }}>
      <div className="container" style={{ padding: '64px 24px 32px' }}>
        <div
          className="split-2"
          style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 40 }}
        >
          <div>
            <div style={{ marginBottom: 16 }}>
              <img src="/logo.png" alt="AriseHash" className="brand-logo footer-logo" width="34" height="34" style={{ height: 34 }} />
            </div>
            <p style={{ color: '#bdbbb1', fontSize: 15, maxWidth: 360, lineHeight: 1.6 }}>
              {t('footer.tagline')}
            </p>
            <Link to={user ? '/app' : '/login'} className="pill" style={{ marginTop: 22, color: '#f4f4f5', borderColor: '#f4f4f5' }}>
              {user ? t('nav.dashboard') : t('nav.login')}
              <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
            </Link>
          </div>

          <FootCol
            title={t('footer.navigation')}
            links={[[t('nav.home'), '/'], [t('nav.about'), '/tentang'], [t('nav.how'), '/cara-kerja'], [t('nav.pricing'), '/harga']]}
          />
          <FootCol
            title={t('footer.help')}
            links={[[t('nav.pricing'), '/harga'], [t('nav.how'), '/cara-kerja'], ['Ketentuan', '/ketentuan'], ['Privasi', '/privasi']]}
          />
        </div>

        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between',
            marginTop: 48, paddingTop: 22, borderTop: '1px solid #43423c',
            color: '#9d9b92', fontSize: 13.5,
          }}
        >
          <span>{t('footer.rights')}</span>
          <span>{t('footer.madeFor')}</span>
        </div>
      </div>
    </footer>
  )
}

function FootCol({ title, links }) {
  return (
    <div>
      <h4 className="display" style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 16, letterSpacing: '.08em' }}>
        {title}
      </h4>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} style={{ color: '#cfcdc4', fontSize: 14.5 }}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
