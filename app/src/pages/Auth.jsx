import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ShieldCheck, ArrowLeft, Fingerprint, Check } from 'lucide-react'
import GoogleButton from '../components/GoogleButton.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import DotGrid from '../components/DotGrid.jsx'
import { useLang } from '../context/LanguageContext.jsx'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/app'
  const { t } = useLang()
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)

  const onGoogleDone = () => navigate(redirectTo, { replace: true })

  return (
    <div className="login">
      {/* animated background */}
      <DotGrid className="login-bg" />
      <div className="login-vignette" aria-hidden="true" />

      {/* floating orbs */}
      <div className="login-orbs" aria-hidden="true">
        <span className="login-orb login-orb-1" />
        <span className="login-orb login-orb-2" />
        <span className="login-orb login-orb-3" />
      </div>

      {/* top bar */}
      <header className="login-top">
        <Link to="/" className="login-back"><ArrowLeft size={16} /> Beranda</Link>
        <img src="/logo.png" alt="AriseHash" className="login-logo" width="26" height="26" />
      </header>

      <div className="login-card-outer">
        <div className="login-card-glow" aria-hidden="true" />
        <BorderGlowCard
          borderRadius={28}
          style={{ width: '100%' }}
          innerStyle={{ padding: '40px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            {/* Logo icon */}
            <motion.div className="login-card-icon"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Fingerprint size={24} strokeWidth={1.8} />
            </motion.div>

            <motion.span className="login-badge"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <ShieldCheck size={13} /> {t('auth.premiumBadge')}
            </motion.span>

            <h1 className="display login-title">{t('auth.signIn')}</h1>
            <p className="login-sub">{t('auth.signInSubtitle')}</p>

            {error && (
              <motion.div className="login-card-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="login-card-error-inner">
                  <AlertCircle size={17} /> {error}
                </div>
              </motion.div>
            )}

            <div className="login-google" aria-disabled={!agreed} style={{ marginTop: '28px' }}>
              <GoogleButton onDone={onGoogleDone} onError={setError} disabled={!agreed} />
            </div>

            <label className="login-consent" style={{ marginTop: '24px' }}>
              <input
                type="checkbox"
                className="login-consent-box"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                aria-label="Setujui Ketentuan & Kebijakan Privasi"
              />
              <span className="login-consent-mark" aria-hidden="true">{agreed && <Check size={12} strokeWidth={3.5} />}</span>
              <span className="login-consent-text">
                Saya menyetujui{' '}
                <Link to="/ketentuan" target="_blank" rel="noopener noreferrer">Ketentuan Layanan</Link>,{' '}
                <Link to="/privasi" target="_blank" rel="noopener noreferrer">Kebijakan Privasi</Link>, dan ketentuan lainnya dari AriseHash.
              </span>
            </label>

          </motion.div>
        </BorderGlowCard>
      </div>

      <span className="login-copy">© 2026 AriseHash</span>
    </div>
  )
}
