import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, MessageSquare, FileText, Code2, Play } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import SEOHead from '../components/SEOHead.jsx'
import BorderGlowCard from '../components/BorderGlowCard.jsx'
import { fadeInView } from '../utils/framer.js'

export default function HowItWorks() {
  const { user } = useAuth()

  const langkah = [
    {
      icon: MessageSquare,
      no: '01',
      title: 'Tulis Ide Aplikasi Kamu',
      desc: 'Masukkan deskripsi aplikasi yang ingin dibuat menggunakan bahasa sehari-hari. Beri tahu AI mengenai fitur-fitur utama yang kamu bayangkan.',
    },
    {
      icon: FileText,
      no: '02',
      title: 'AI Merancang Dokumen PRD',
      desc: 'Asisten cerdas kami akan menganalisis ide kamu dan menyusun spesifikasi fungsional, alur database, diagram alir, serta arsitektur modul.',
    },
    {
      icon: Code2,
      no: '03',
      title: 'Generate & Eksekusi Kode',
      desc: 'AI akan menerjemahkan rancangan tersebut ke dalam berkas kode nyata. Struktur proyek dan dependensinya langsung dibuat otomatis.',
    },
    {
      icon: Play,
      no: '04',
      title: 'Live Sandbox & Iterasi',
      desc: 'Hasil pengerjaan langsung dijalankan dalam browser secara live-preview. Kamu dapat meminta revisi atau fitur tambahan melalui chat kapan saja.',
    },
  ]

  return (
    <>
      <div className="container section">
      <SEOHead title="Cara Kerja" description="Ketahui bagaimana AriseHash membantu kamu merancang dan merakit aplikasi secara instan dengan teknologi AI." path="/cara-kerja" />
      <motion.div {...fadeInView(0)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span className="eyebrow">Alur Kerja</span>
      </motion.div>

      <motion.h1 {...fadeInView(0.05)} className="display h-lg" style={{ maxWidth: 720 }}>
        Bagaimana AriseHash Bekerja?
      </motion.h1>
      <motion.p {...fadeInView(0.1)} className="text-muted" style={{ fontSize: 16, maxWidth: 620, marginTop: 16, ...{lineHeight: 1.7} }}>
        Kami menghubungkan kekuatan analisis bahasa AI untuk merancang arsitektur aplikasi dan mesin compiler di browser
        guna menjalankan kode secara instan. Semua proses dilakukan secara otomatis di balik layar.
      </motion.p>

      {/* Steps list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginTop: 46 }}>
        {langkah.map((l, i) => (
          <motion.div key={l.no} {...fadeInView(i * 0.08)} style={{ height: '100%' }}>
            <BorderGlowCard style={{ height: '100%' }} innerStyle={{ height: '100%', padding: 26 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 13, background: 'var(--indigo)', border: '1.5px solid var(--ink)' }}>
                  <l.icon size={24} color="var(--on-ink)" strokeWidth={2.1} />
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--muted)', opacity: 0.35, fontFamily: 'monospace' }}>{l.no}</span>
              </div>
              <h3 className="display" style={{ fontSize: 18 }}>{l.title}</h3>
              <p className="text-muted" style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>{l.desc}</p>
            </BorderGlowCard>
          </motion.div>
        ))}
      </div>
      </div>

      {/* Visual Demo Section - Full Widescreen Width */}
      <div style={{ width: '100%', padding: '52px 24px 40px', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
          <h2 className="display h-md" style={{ textAlign: 'center', marginBottom: 32 }}>Demonstrasi Fitur Utama</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 28 }}>
            {/* Demo 1: PRD */}
            <motion.div {...fadeInView(0.1)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BorderGlowCard borderRadius={20} colors={['#818cf8', '#6366f1']} backgroundColor="#0f0d14" innerStyle={{ padding: '8px' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', overflow: 'hidden', borderRadius: 14, background: '#07050a' }}>
                  <video
                    src="/build_project.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </BorderGlowCard>
              <div style={{ padding: '0 8px' }}>
                <h3 className="display" style={{ fontSize: 18, color: '#f4f4f5' }}>1. Build Project (Rencana & Skema DB)</h3>
                <p className="text-muted" style={{ fontSize: 14.5, marginTop: 6, lineHeight: 1.6 }}>
                  Masukkan konsep aplikasi kasar kamu. AI akan menganalisis dan menyusun spesifikasi kebutuhan teknis secara lengkap (PRD), 
                  membangun alur logika flowchart, serta memetakan skema database relasional secara instan.
                </p>
              </div>
            </motion.div>

            {/* Demo 2: Code Compilation */}
            <motion.div {...fadeInView(0.2)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BorderGlowCard borderRadius={20} colors={['#c084fc', '#a855f7']} backgroundColor="#0f0d14" innerStyle={{ padding: '8px' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', overflow: 'hidden', borderRadius: 14, background: '#07050a' }}>
                  <video
                    src="/build_code.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </BorderGlowCard>
              <div style={{ padding: '0 8px' }}>
                <h3 className="display" style={{ fontSize: 18, color: '#f4f4f5' }}>2. Build Code (Tulis & Jalankan Kode)</h3>
                <p className="text-muted" style={{ fontSize: 14.5, marginTop: 6, lineHeight: 1.6 }}>
                  Chat langsung dengan AI asisten untuk mengompilasi kode program. Hasil rancangan kode React dapat langsung dijalankan 
                  secara live-preview dalam browser sandbox interaktif, memungkinkan edit file dan uji coba tanpa ribet setup environment lokal.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="container section" style={{ paddingTop: 0 }}>
        {/* Detail info */}
        <motion.div {...fadeInView(0)}>
          <BorderGlowCard backgroundColor="#161b22" innerStyle={{ padding: 'clamp(28px, 4vw, 44px)' }}>
            <h2 className="display h-md" style={{ marginBottom: 14 }}>Sandbox Berkinerja Tinggi</h2>
            <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.7, maxWidth: 760 }}>
              Tidak seperti asisten AI biasa yang hanya memberikan cuplikan kode teks, AriseHash langsung merakit proyek fungsional. 
              Teknologi virtual browser compiler (Sandpack) memungkinkan kamu menjalankan, menguji, dan mengunduh berkas ZIP dari kode 
              yang telah dibuat, semuanya tanpa memerlukan instalasi Node.js lokal.
            </p>
          </BorderGlowCard>
        </motion.div>

        {/* CTA */}
        <BorderGlowCard style={{ marginTop: 40 }} innerStyle={{ padding: 'clamp(28px, 4vw, 44px)', flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="display" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#f4f4f5', maxWidth: 460 }}>
            Siap Mewujudkan Aplikasi Impian Kamu?
          </h2>
          <BorderGlowCard style={{ border: 'none' }} innerStyle={{ border: 'none', background: 'transparent' }}>
            <Link to={user ? '/app' : '/login'} className="pill" style={{ background: '#2a2a30', borderColor: '#2a2a30', color: '#f5f5f6' }}>
              {user ? 'Buka Dasbor' : 'Mulai Sekarang'} <span className="pill-ic" style={{ background: '#18181b', color: '#f4f4f5' }}><ArrowUpRight size={16} strokeWidth={2.6} /></span>
            </Link>
          </BorderGlowCard>
        </BorderGlowCard>
      </div>
    </>
  )
}
