import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ArrowUpRight, Zap, LoaderCircle, ExternalLink, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import SEOHead from '../components/SEOHead.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { fadeInView } from '../utils/framer.js'
import { api } from '../api.js'

const plans = [
  {
    name: 'Gratis (Free Tier)',
    price: 'Rp0',
    period: 'selamanya',
    desc: 'Sempurna untuk mengeksplorasi asisten AI dan mencoba pembuatan proyek perdana secara gratis.',
    features: [
      '1 proyek baru tiap 7 hari',
      '100 kredit AI tiap 7 hari (untuk kode & obrolan)',
      'Akses model khusus MiMo 2.5 Pro',
      'Ekspor berkas proyek dasar (.md)',
      'Akses editor workspace & template terbatas',
    ],
    cta: 'Mulai Gratis',
    highlight: false,
    planType: 'FREE',
  },
  {
    name: 'Starter (Pro Plan)',
    price: 'Rp20rb',
    period: '/bulan',
    desc: 'Pilihan hemat bertenaga untuk developer mandiri, mahasiswa, dan pembuat kode hobi.',
    features: [
      '5 proyek baru tiap 4 hari',
      '500 kredit AI tiap 4 hari (untuk kode & obrolan)',
      'Buka semua model AI premium (Gemini, Claude, Qwen, MiMo)',
      'Integrasi API Key sendiri (BYOK / tanpa batas kuota)',
      'Akses galeri template lengkap',
      'Ekspor kode & dokumen proyek penuh',
    ],
    cta: 'Pilih Starter',
    highlight: true,
    planType: 'PRO',
  },
  {
    name: 'Pro Max (Premium Plan)',
    price: 'Rp75rb',
    period: '/bulan',
    desc: 'Kuota ultra besar dan performa maksimal tanpa kompromi untuk tim, startup, dan proyek berskala industri.',
    features: [
      '200 proyek baru tiap 5 jam (FUP)',
      '2000 kredit AI tiap 5 jam (untuk kode & obrolan)',
      'Akses semua model AI premium prioritas tinggi',
      'Koneksi API Key sendiri tanpa batasan sistem',
      'Dukungan workspace multi-page & sandbox penuh',
      'Antrean server prioritas untuk respon lebih cepat',
    ],
    cta: 'Pilih Pro Max',
    highlight: false,
    planType: 'PRO_MAX',
  },
]

export default function Pricing() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const to = user ? '/app' : '/login'
  const [checkout, setCheckout] = useState(null)
  const [busyPlan, setBusyPlan] = useState(null)
  const [checking, setChecking] = useState(false)

  const startCheckout = async (plan) => {
    if (!user) {
      navigate('/login')
      return
    }
    if (plan.planType === 'FREE') {
      navigate('/app')
      return
    }

    try {
      setBusyPlan(plan.planType)
      const data = await api.createPakasirCheckout(plan.planType)
      setCheckout(data)
      addToast('Pembayaran Pakasir siap.', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusyPlan(null)
    }
  }

  const checkPayment = async (silent = false) => {
    if (!checkout || checking) return
    try {
      setChecking(true)
      const result = await api.pakasirStatus({ orderId: checkout.orderId, amount: checkout.amount })
      if (result.paid) {
        setCheckout((prev) => prev ? { ...prev, paid: true } : prev)
        addToast('Pembayaran berhasil. Paket kamu sudah aktif.', 'success', 5000)
        return
      }
      if (!silent) addToast('Pembayaran belum terdeteksi.', 'info')
    } catch (err) {
      if (!silent) addToast(err.message, 'error')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (!checkout || checkout.paid) return undefined
    const timer = setInterval(() => { checkPayment(true) }, 8000)
    return () => clearInterval(timer)
  }, [checkout?.orderId, checkout?.paid])

  return (
    <div className="container section">
      <SEOHead title="Harga" description="Pilih paket AriseHash yang sesuai kebutuhan — dari Gratis hingga Pro (Pro Max) dengan kuota besar." path="/harga" />
      <motion.div {...fadeInView(0)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span className="eyebrow">Harga</span>
      </motion.div>

      <motion.h1 {...fadeInView(0.05)} className="display h-lg" style={{ maxWidth: 640 }}>
        Mulai Gratis, Bayar Kalau Butuh Lebih
      </motion.h1>
      <motion.p {...fadeInView(0.1)} className="text-muted" style={{ fontSize: 16, maxWidth: 560, marginTop: 16, lineHeight: 1.7 }}>
        Tidak ada biaya tersembunyi. Coba dulu tanpa bayar, lalu naik paket kapan saja
        kalau kebutuhanmu bertambah. Batas pemakaian disegarkan sesuai siklus masing-masing paket.
      </motion.p>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 18px rgba(168, 85, 247, 0.65);
          }
        }
        @keyframes rotateZap {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .anim-glow-badge {
          animation: pulseGlow 2.5s infinite ease-in-out;
        }
        .anim-spin-zap {
          animation: rotateZap 6s linear infinite;
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 46, alignItems: 'stretch' }}>
        {plans.map((p, i) => (
          <motion.div key={p.name} {...fadeInView(i * 0.08)} style={{ height: '100%', position: 'relative' }}>
            {p.highlight && (
              <div style={{ position: 'absolute', top: -14, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                <span
                  className="chip anim-glow-badge"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    color: '#ffffff',
                    borderColor: 'transparent',
                    padding: '5px 14px',
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Zap size={12} className="anim-spin-zap" style={{ color: '#fbbf24' }} /> Paling Populer
                </span>
              </div>
            )}
            <BorderGlowCard
              animated={p.highlight}
              backgroundColor={p.highlight ? '#181030' : '#120F17'}
              glowIntensity={p.highlight ? 1.25 : 1}
              style={{ height: '100%' }}
              innerStyle={{
                height: '100%', padding: 30, position: 'relative',
                color: p.highlight ? '#f4f4f5' : 'var(--ink)',
              }}
            >
              <h3 className="display" style={{ fontSize: 22 }}>{p.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                <span className="display" style={{ fontSize: 34 }}>{p.price}</span>
                <span style={{ fontSize: 14, color: p.highlight ? 'rgba(244,244,245,.66)' : 'var(--muted)' }}>{p.period}</span>
              </div>
              <p style={{ fontSize: 14, marginTop: 10, lineHeight: 1.5, color: p.highlight ? 'rgba(244,244,245,.66)' : 'var(--muted)' }}>{p.desc}</p>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: 11, margin: '22px 0 26px' }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5 }}>
                    <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 999, background: p.highlight ? '#f4f4f5' : 'var(--surface-2)', border: p.highlight ? '1.5px solid #f4f4f5' : '1.5px solid var(--ink)', color: '#18181b' }}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => startCheckout(p)}
                disabled={busyPlan === p.planType}
                className={p.highlight ? 'pill' : 'pill pill-indigo'}
                style={{ width: '100%', marginTop: 'auto', justifyContent: 'center', ...(p.highlight ? { background: '#2a2a30', borderColor: '#2a2a30', color: '#f5f5f6' } : {}) }}
              >
                {busyPlan === p.planType ? 'Menyiapkan...' : p.cta}
                <span className="pill-ic" style={p.highlight ? { background: '#18181b', color: '#f4f4f5' } : {}}>
                  {busyPlan === p.planType ? <LoaderCircle size={16} className="spin" /> : <ArrowUpRight size={16} strokeWidth={2.6} />}
                </span>
              </button>
            </BorderGlowCard>
          </motion.div>
        ))}
      </div>

      <motion.p {...fadeInView(0)} className="text-muted" style={{ fontSize: 13.5, marginTop: 26, textAlign: 'center' }}>
        Semua paket tidak terikat kontrak. Kamu bisa berhenti kapan saja.
      </motion.p>

      {checkout && (
        <div className="modal-overlay" style={{ zIndex: 100000, placeItems: 'center', padding: 16 }}>
          <section
            className="modal-card pakasir-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pakasir-checkout-title"
          >
            <div className="modal-head">
              <div style={{ minWidth: 0 }}>
                <h2 id="pakasir-checkout-title" className="display" style={{ fontSize: 20 }}>Bayar {checkout.planName}</h2>
                <p className="text-muted" style={{ fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>Order {checkout.orderId}</p>
              </div>
              <button className="dash-hist-del" onClick={() => setCheckout(null)} aria-label="Tutup pembayaran">
                <X size={16} />
              </button>
            </div>
            <div className="modal-body pakasir-modal-body">
              <div className="pakasir-frame-wrap">
                <iframe
                  title="Pembayaran Pakasir QRIS"
                  src={checkout.paymentUrl}
                  className="pakasir-frame"
                  allow="payment *"
                />
              </div>
              <aside className="pakasir-side">
                <div className="qris-box" style={{ margin: 0 }}>
                  <div className="qris-head">
                    <Zap size={16} />
                    <strong>QRIS Pakasir</strong>
                  </div>
                  <div className="qris-amount">
                    <span className="display" style={{ fontSize: 26 }}>{formatRupiah(checkout.amount)}</span>
                    <span className="text-muted" style={{ fontSize: 12 }}>Scan QRIS di panel pembayaran</span>
                  </div>
                </div>
                {checkout.paid && (
                  <div className="pay-detected">
                    <Check size={15} /> Pembayaran berhasil
                  </div>
                )}
                <button className="pay-check-btn" onClick={() => checkPayment(false)} disabled={checking || checkout.paid}>
                  {checking ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
                  {checkout.paid ? 'Plan aktif' : 'Cek pembayaran'}
                </button>
                <a className="pill" href={checkout.paymentUrl} target="_blank" rel="noreferrer" style={{ justifyContent: 'center' }}>
                  Buka tab baru <span className="pill-ic"><ExternalLink size={15} /></span>
                </a>
                <Link className="pill pill-indigo" to={to} onClick={() => checkout.paid && setCheckout(null)} style={{ justifyContent: 'center' }}>
                  Ke dashboard <span className="pill-ic"><ArrowUpRight size={15} /></span>
                </Link>
                <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  Setelah QRIS dibayar, sistem mengecek status otomatis. Jika belum berubah, tekan cek pembayaran.
                </p>
              </aside>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value)
}
