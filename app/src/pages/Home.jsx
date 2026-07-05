import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, animate } from 'framer-motion'
import SEOHead from '../components/SEOHead.jsx'
import {
  ArrowUpRight, MessageSquare, FileText, Code2,
  Clock, Wallet, ShieldCheck, Zap, Brain, Layers
} from 'lucide-react'
import Waves from '../components/Waves.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

/* Reveal-on-scroll wrapper, centered. */
function Reveal({ children, delay = 0, y = 28 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* Animated number counter. */
function Counter({ to, suffix = '', duration = 1.6 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, { duration, ease: 'easeOut', onUpdate: (v) => setVal(Math.floor(v)) })
    return () => controls.stop()
  }, [inView, to, duration])
  return <span ref={ref}>{val.toLocaleString('id-ID')}{suffix}</span>
}

const ROTATING = ['home.rotating.web', 'home.rotating.saas', 'home.rotating.shop', 'home.rotating.chat', 'home.rotating.mobile']

export default function Home() {
  const { user } = useAuth()
  const { t } = useLang()
  const ctaTo = user ? '/app' : '/login'
  const [demoTab, setDemoTab] = useState('prd')

  // Hero parallax on scroll
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  // Rotating word
  const [wi, setWi] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setWi((i) => (i + 1) % ROTATING.length), 2200)
    return () => clearInterval(t)
  }, [])

  const fitur = [
    { icon: MessageSquare, title: t('home.feature.1.title'), desc: t('home.feature.1.desc') },
    { icon: FileText, title: t('home.feature.2.title'), desc: t('home.feature.2.desc') },
    { icon: Code2, title: t('home.feature.3.title'), desc: t('home.feature.3.desc') },
  ]
  const alasan = [
    { icon: Clock, title: t('home.why.1.title'), desc: t('home.why.1.desc') },
    { icon: Wallet, title: t('home.why.2.title'), desc: t('home.why.2.desc') },
    { icon: ShieldCheck, title: t('home.why.3.title'), desc: t('home.why.3.desc') },
  ]
  const langkah = [
    { no: '01', title: t('home.steps.1.title'), desc: t('home.steps.1.desc') },
    { no: '02', title: t('home.steps.2.title'), desc: t('home.steps.2.desc') },
    { no: '03', title: t('home.steps.3.title'), desc: t('home.steps.3.desc') },
  ]

  return (
    <div className="lp">
      <SEOHead title="Beranda" description="AriseHash — asisten AI untuk menyusun PRD, arsitektur, dan prototipe kode aplikasi langsung di browser." path="/" />
      {/* ===== HERO ===== */}
      <section ref={heroRef} className="lp-hero">
        {/* animated background — reactbits Waves (theme-aware) */}
        <div className="lp-aurora" aria-hidden="true">
          <motion.span className="lp-orb lp-orb-1" style={{ y: orbY }} />
          <motion.span className="lp-orb lp-orb-2" style={{ y: orbY }} />
          <Waves className="lp-waves" />
          <span className="lp-grid" />
        </div>

        <motion.div className="lp-hero-inner" style={{ opacity: heroFade }}>
          <motion.h1 className="lp-title"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}>
            {t('home.hero.titleA')}
            <br />
            <span className="lp-rotate-wrap">
              <motion.span
                key={wi}
                className="lp-rotate"
                initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -22 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                {t(ROTATING[wi])}
              </motion.span>
            </span>
            <br />
            {t('home.hero.titleB')}
          </motion.h1>

          <motion.p className="lp-sub"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.22 }}>
            {t('home.hero.sub')}
          </motion.p>

          <motion.div className="lp-cta"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.32 }}>
            <Link to={ctaTo} className="pill pill-indigo lp-cta-main">
              {t('home.hero.cta.free')}
              <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
            </Link>
            <Link to="/cara-kerja" className="pill">{t('home.hero.cta.work')}</Link>
          </motion.div>

          <motion.div className="lp-stats"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
            <div className="lp-stat"><div className="lp-stat-val">&lt; 5<span className="lp-stat-unit">mnt</span></div><div className="lp-stat-label">{t('home.stat.speed')}</div></div>
            <div className="lp-stat-divider" />
            <div className="lp-stat"><div className="lp-stat-val"><Counter to={100} suffix="%" /></div><div className="lp-stat-label">{t('home.stat.browser')}</div></div>
            <div className="lp-stat-divider" />
            <div className="lp-stat"><div className="lp-stat-val">2<span className="lp-stat-unit">mode</span></div><div className="lp-stat-label">{t('home.stat.modes')}</div></div>
          </motion.div>
        </motion.div>

        <motion.div className="lp-scroll-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <span className="lp-scroll-dot" />
        </motion.div>
      </section>

      {/* ===== VIDEO SHOWCASE ===== */}
      <section style={{ width: '100%', maxWidth: '100%', padding: '0 24px 20px', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: '100%',
            maxWidth: '1440px',
            marginLeft: 'auto',
            marginRight: 'auto',
            position: 'relative'
          }}
        >
          <BorderGlowCard
            borderRadius={20}
            glowIntensity={1.25}
            colors={['#818cf8', '#c084fc', '#6366f1']}
            backgroundColor="#0c0a12"
            innerStyle={{ padding: '8px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '12px 14px', borderBottom: '1px solid rgb(255 255 255 / 8%)', justifyContent: 'center' }}>
                <button 
                  className={`pill ${demoTab === 'prd' ? 'pill-indigo' : ''}`}
                  onClick={() => setDemoTab('prd')}
                  style={{ fontSize: 13, padding: '6px 16px', cursor: 'pointer' }}
                >
                  <FileText size={14} /> {t('home.showcase.tab.prd')}
                </button>
                <button 
                  className={`pill ${demoTab === 'code' ? 'pill-indigo' : ''}`}
                  onClick={() => setDemoTab('code')}
                  style={{ fontSize: 13, padding: '6px 16px', cursor: 'pointer' }}
                >
                  <Code2 size={14} /> {t('home.showcase.tab.code')}
                </button>
              </div>

              {/* Video Container */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', overflow: 'hidden', borderRadius: 14, background: '#07050a' }}>
                {demoTab === 'prd' ? (
                  <motion.video
                    key="prd-video"
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    src="/build_project.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <motion.video
                    key="code-video"
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    src="/build_code.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
            </div>
          </BorderGlowCard>
        </motion.div>
      </section>

      {/* ===== FITUR ===== */}
      <section className="lp-section">
        <Reveal>
          <span className="eyebrow lp-center-eyebrow">{t('home.feature.eyebrow')}</span>
          <h2 className="display lp-h2">{t('home.feature.title')}</h2>
        </Reveal>
        <div className="lp-grid-3">
          {fitur.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.1}>
              <BorderGlowCard borderRadius={22} style={{ height: '100%' }} innerStyle={{ height: '100%', padding: '32px 26px', alignItems: 'center', textAlign: 'center' }}>
                <span className="lp-card-ic"><f.icon size={24} strokeWidth={2.1} /></span>
                <h3 className="display lp-card-title">{f.title}</h3>
                <p className="lp-card-desc">{f.desc}</p>
              </BorderGlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== LANGKAH ===== */}
      <section className="lp-section">
        <Reveal>
          <span className="eyebrow lp-center-eyebrow">{t('home.steps.eyebrow')}</span>
          <h2 className="display lp-h2">{t('home.steps.title')}</h2>
        </Reveal>
        <div className="lp-steps">
          {langkah.map((s, i) => (
            <Reveal key={s.no} delay={i * 0.12}>
              <div className="lp-step">
                <span className="lp-step-no">{s.no}</span>
                <h3 className="display lp-step-title">{s.title}</h3>
                <p className="lp-card-desc">{s.desc}</p>
                {i < langkah.length - 1 && <span className="lp-step-line" aria-hidden="true" />}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== ALASAN ===== */}
      <section className="lp-section">
        <Reveal>
          <span className="eyebrow lp-center-eyebrow">{t('home.why.eyebrow')}</span>
          <h2 className="display lp-h2">{t('home.why.title')}</h2>
        </Reveal>
        <div className="lp-grid-3">
          {alasan.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.1}>
              <BorderGlowCard borderRadius={22} backgroundColor="#1a161f" style={{ height: '100%' }} innerStyle={{ height: '100%', padding: '32px 26px', alignItems: 'center', textAlign: 'center' }}>
                <span className="lp-card-ic lp-card-ic-soft"><a.icon size={22} /></span>
                <h3 className="display lp-card-title">{a.title}</h3>
                <p className="lp-card-desc">{a.desc}</p>
              </BorderGlowCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="lp-section lp-cta-section">
        <Reveal>
          <div className="lp-cta-band">
            <div className="lp-cta-glow" aria-hidden="true" />
            <span className="chip chip-lime">{t('home.cta.eyebrow')}</span>
            <h2 className="display lp-cta-title">{t('home.cta.title')}</h2>
            <p className="lp-cta-text">{t('home.cta.desc')}</p>
            <Link to={ctaTo} className="pill lp-cta-btn">
              {user ? t('home.cta.dashboard') : t('home.cta.start')}
              <span className="pill-ic" style={{ background: '#18181b', color: '#f4f4f5' }}>
                <ArrowUpRight size={16} strokeWidth={2.6} />
              </span>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
