import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Heart, Target, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import SEOHead from '../components/SEOHead.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { fadeInView } from '../utils/framer.js'

export default function About() {
  const { user } = useAuth()

  const nilai = [
    { icon: Heart, title: 'Mudah untuk Semua', desc: 'Kami percaya siapa pun berhak membuat aplikasi, walau belum pernah menulis satu baris kode pun.' },
    { icon: Target, title: 'Fokus ke Ide', desc: 'Biar kamu mengurus ide dan kreativitas, urusan teknis yang rumit kami serahkan ke AI.' },
    { icon: Users, title: 'Untuk Pemula & Profesional', desc: 'Cocok buat yang baru belajar, pelaku usaha, sampai developer yang ingin kerja lebih cepat.' },
  ]

  return (
    <div className="container section">
      <SEOHead title="Tentang Kami" description="Kenali tim dan misi AriseHash — membantu siapa pun membangun aplikasi dengan bantuan AI." path="/tentang" />
      <motion.div {...fadeInView(0)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span className="eyebrow">Tentang Kami</span>
      </motion.div>

      <motion.h1 {...fadeInView(0.05)} className="display h-lg" style={{ maxWidth: 720 }}>
        Kami Membantu Siapa Saja Membuat Aplikasi
      </motion.h1>
      <motion.p {...fadeInView(0.1)} className="text-muted" style={{ fontSize: 16, maxWidth: 620, marginTop: 16, lineHeight: 1.7 }}>
        Dulu, membuat aplikasi butuh tim, waktu lama, dan biaya besar. Kami ingin mengubah itu.
        Dengan bantuan AI, kamu cukup menceritakan idemu dengan bahasa sehari-hari — sisanya kami yang urus.
        Tujuan kami sederhana: membuat proses membangun aplikasi terasa semudah mengobrol.
      </motion.p>

      {/* Nilai */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginTop: 46 }}>
        {nilai.map((n, i) => (
          <motion.div key={n.title} {...fadeInView(i * 0.08)} style={{ height: '100%' }}>
            <BorderGlowCard style={{ height: '100%' }} innerStyle={{ height: '100%', padding: 26 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 13, background: 'var(--indigo)', border: '1.5px solid var(--ink)', marginBottom: 16 }}>
                <n.icon size={24} color="var(--on-ink)" strokeWidth={2.1} />
              </span>
              <h3 className="display" style={{ fontSize: 18 }}>{n.title}</h3>
              <p className="text-muted" style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>{n.desc}</p>
            </BorderGlowCard>
          </motion.div>
        ))}
      </div>

      {/* Cerita singkat */}
      <motion.div {...fadeInView(0)} style={{ marginTop: 40 }}>
        <BorderGlowCard backgroundColor="#1a161f" innerStyle={{ padding: 'clamp(28px, 4vw, 44px)' }}>
          <h2 className="display h-md" style={{ marginBottom: 14 }}>Kenapa Kami Membuat Ini?</h2>
          <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.7, maxWidth: 760 }}>
            Banyak orang punya ide aplikasi yang bagus, tapi terhenti karena merasa "tidak bisa coding".
            Padahal ide itu yang paling berharga. Kami membangun asisten ini supaya jarak antara
            ide di kepala dan aplikasi yang bisa dipakai jadi sependek mungkin — cukup dengan mengetik
            apa yang kamu mau.
          </p>
        </BorderGlowCard>
      </motion.div>

      {/* CTA */}
      <BorderGlowCard style={{ marginTop: 40 }} innerStyle={{ padding: 'clamp(28px, 4vw, 44px)', flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="display" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#f4f4f5', maxWidth: 460 }}>
          Yuk, Coba Sendiri Sekarang
        </h2>
        <Link to={user ? '/app' : '/login'} className="pill" style={{ background: '#2a2a30', borderColor: '#2a2a30', color: '#f5f5f6' }}>
          {user ? 'Buka Dasbor' : 'Mulai Gratis'} <span className="pill-ic" style={{ background: '#18181b', color: '#f4f4f5' }}><ArrowUpRight size={16} strokeWidth={2.6} /></span>
        </Link>
      </BorderGlowCard>
    </div>
  )
}
