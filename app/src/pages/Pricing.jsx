import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ArrowUpRight, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import SEOHead from '../components/SEOHead.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { fadeInView } from '../utils/framer.js'

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
  },
]

export default function Pricing() {
  const { user } = useAuth()
  const to = user ? '/app' : '/login'

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

      {/* Plans */}
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

              <Link
                to={to}
                className={p.highlight ? 'pill' : 'pill pill-indigo'}
                style={{ marginTop: 'auto', justifyContent: 'center', ...(p.highlight ? { background: '#2a2a30', borderColor: '#2a2a30', color: '#f5f5f6' } : {}) }}
              >
                {p.cta}
                <span className="pill-ic" style={p.highlight ? { background: '#18181b', color: '#f4f4f5' } : {}}>
                  <ArrowUpRight size={16} strokeWidth={2.6} />
                </span>
              </Link>
            </BorderGlowCard>
          </motion.div>
        ))}
      </div>

      <motion.p {...fadeInView(0)} className="text-muted" style={{ fontSize: 13.5, marginTop: 26, textAlign: 'center' }}>
        Semua paket tidak terikat kontrak. Kamu bisa berhenti kapan saja.
      </motion.p>
    </div>
  )
}
