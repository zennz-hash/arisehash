import { Link, useLocation } from 'react-router-dom'

const docs = {
  '/ketentuan': {
    title: 'Ketentuan Layanan',
    updated: '20 Juni 2026',
    sections: [
      ['Penggunaan layanan', 'AriseHash membantu membuat PRD, chat teknis, dan prototipe frontend. Output AI harus ditinjau sebelum dipakai untuk keputusan produksi.'],
      ['Akun dan keamanan', 'Pengguna bertanggung jawab menjaga akses akun Google dan model API sendiri. Session dapat dicabut dari halaman Pengaturan.'],
      ['Konten dan proyek', 'Pengguna tetap bertanggung jawab atas ide, prompt, file, dan proyek yang dibuat atau dibagikan. Jangan unggah rahasia yang tidak perlu diproses AI.'],
      ['Batas pemakaian', 'Quota harian berlaku berdasarkan paket aktif dan dapat berubah sesuai kebijakan operasional. BYOK memakai API key pengguna dan tidak memotong quota bawaan.'],
      ['Batasan prototipe', 'Workspace kode berjalan sebagai sandbox frontend di browser, bukan runtime backend production-ready.']
    ]
  },
  '/privasi': {
    title: 'Kebijakan Privasi',
    updated: '20 Juni 2026',
    sections: [
      ['Data akun', 'Kami menyimpan nama, email, foto profil Google, role, session, quota, dan metadata penggunaan untuk menjalankan layanan.'],
      ['Data proyek', 'Blueprint, chat, file workspace, versi, dan share link disimpan agar pengguna dapat melanjutkan pekerjaan.'],
      ['API key sendiri', 'API key BYOK disimpan terenkripsi menggunakan AES-256-GCM dan tidak pernah dikirim ke frontend setelah disimpan.'],
      ['Penghapusan data', 'Pengguna dapat menghapus akun dari Pengaturan. Penghapusan akun ikut menghapus proyek, chat, key, dan session terkait.'],
      ['AI provider', 'Saat menggunakan model bawaan atau BYOK, prompt dan lampiran yang relevan dikirim ke endpoint model yang dipilih untuk menghasilkan respons.']
    ]
  }
}

export default function Legal() {
  const { pathname } = useLocation()
  const doc = docs[pathname] || docs['/ketentuan']
  return (
    <div className="container section" style={{ maxWidth: 820 }}>
      <span className="eyebrow">Legal</span>
      <h1 className="display h-lg" style={{ marginTop: 10 }}>{doc.title}</h1>
      <p className="text-muted" style={{ marginTop: 12 }}>Terakhir diperbarui: {doc.updated}</p>
      <div className="card" style={{ padding: 28, marginTop: 28 }}>
        {doc.sections.map(([title, body]) => (
          <section key={title} style={{ marginBottom: 24 }}>
            <h2 className="display" style={{ fontSize: 18, marginBottom: 8 }}>{title}</h2>
            <p className="text-muted" style={{ lineHeight: 1.7 }}>{body}</p>
          </section>
        ))}
        <Link to="/" className="pill pill-indigo">Kembali</Link>
      </div>
    </div>
  )
}
