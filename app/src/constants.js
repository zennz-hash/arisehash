// Shared configuration constants extracted from pages to eliminate duplication.
// Icons are NOT included here — each page imports its own icons and maps them at render time.

// ── Templates (Store.jsx) ──────────────────────────────────────────────────
export const TEMPLATE_OPTIONS = [
  { value: 'saas', label: 'SaaS / Platform' },
  { value: 'ai-agent', label: 'Agent / Chatbot' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'lms', label: 'LMS / Edukasi' },
  { value: 'web3', label: 'Web3 / Crypto' },
  { value: 'mobile', label: 'Aplikasi Mobile' },
  { value: 'web-app', label: 'Tool / Web App' },
]

// ── Tech Stack Options (Store.jsx) ─────────────────────────────────────────
export const FRONTEND_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: 'React', label: 'React' },
  { value: 'Next.js', label: 'Next.js' },
  { value: 'Vue', label: 'Vue' },
  { value: 'Svelte', label: 'Svelte' },
  { value: 'Angular', label: 'Angular' },
  { value: 'React Native', label: 'React Native' },
  { value: 'Flutter', label: 'Flutter' },
  { value: 'HTML/CSS', label: 'HTML/CSS' },
]

export const BACKEND_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: 'Node.js + Express', label: 'Node.js + Express' },
  { value: 'Next.js API', label: 'Next.js API' },
  { value: 'Python + FastAPI', label: 'Python + FastAPI' },
  { value: 'Django', label: 'Django' },
  { value: 'Laravel', label: 'Laravel' },
  { value: 'Go', label: 'Go' },
  { value: 'Rails', label: 'Rails' },
  { value: 'Supabase', label: 'Supabase' },
  { value: 'Firebase', label: 'Firebase' },
]

export const DATABASE_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'MySQL', label: 'MySQL' },
  { value: 'MongoDB', label: 'MongoDB' },
  { value: 'SQLite', label: 'SQLite' },
  { value: 'Redis', label: 'Redis' },
  { value: 'Firestore', label: 'Firestore' },
  { value: 'Supabase', label: 'Supabase' },
]

export const DEPLOY_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: 'Vercel', label: 'Vercel' },
  { value: 'Netlify', label: 'Netlify' },
  { value: 'AWS', label: 'AWS' },
  { value: 'Google Cloud', label: 'Google Cloud' },
  { value: 'Railway', label: 'Railway' },
  { value: 'Fly.io', label: 'Fly.io' },
  { value: 'VPS/Docker', label: 'VPS/Docker' },
]

// ── Code Build Stacks (BuildCode.jsx) ──────────────────────────────────────
export const STACKS = [
  { value: 'react', label: 'React' },
  { value: 'react-ts', label: 'React + TS' },
  { value: 'vue', label: 'Vue 3' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'vanilla', label: 'Vanilla JS' },
  { value: 'vanilla-ts', label: 'Vanilla TS' },
  { value: 'other', label: 'Lainnya (Jelaskan)' },
]

// ── Suggestions (Store.jsx — text only) ────────────────────────────────────
export const SUGGESTIONS_STORE = [
  'Aplikasi catatan keuangan harian dengan grafik pengeluaran',
  'Marketplace jasa freelance dengan sistem escrow',
  'Dashboard analitik penjualan untuk UMKM',
  'Platform belajar online dengan kuis dan sertifikat',
]

// ── Suggestions (BuildCode.jsx — text + icon ref) ──────────────────────────
// Icons are mapped at render time in BuildCode.jsx.
export const SUGGESTIONS_CODE = [
  { iconName: 'Layers', label: 'Landing page SaaS dengan hero, fitur, dan harga', text: 'Buat landing page SaaS modern dengan hero, daftar fitur, tabel harga, dan tombol CTA.' },
  { iconName: 'Bot', label: 'Antarmuka chat dengan riwayat pesan', text: 'Buat antarmuka chat dengan daftar pesan, input di bawah, dan bubble pengguna/asisten.' },
  { iconName: 'Globe', label: 'Dashboard analitik dengan kartu statistik & grafik', text: 'Buat dashboard analitik dengan kartu statistik, grafik garis, dan tabel data terbaru.' },
  { iconName: 'Smartphone', label: 'Aplikasi to-do dengan filter & local storage', text: 'Buat aplikasi to-do list dengan tambah/hapus, filter selesai, dan simpan ke local storage.' },
  { iconName: 'Layers', label: 'CRM pipeline kanban', text: 'Buat prototype CRM pipeline dengan kolom lead, qualified, proposal, won, kartu deal, dan ringkasan revenue.' },
  { iconName: 'Globe', label: 'POS kasir UMKM', text: 'Buat prototype POS kasir dengan katalog produk, keranjang, total pembayaran, dan riwayat transaksi lokal.' },
  { iconName: 'Smartphone', label: 'Booking jadwal layanan', text: 'Buat prototype booking jadwal layanan dengan kalender sederhana, pilihan jam, detail pelanggan, dan status booking.' },
  { iconName: 'Bot', label: 'LMS kursus mini', text: 'Buat prototype LMS dengan daftar kursus, progres belajar, modul video, dan kuis pilihan ganda.' },
]

// ── Admin (Admin.jsx) ──────────────────────────────────────────────────────
export const PROVIDERS = ['openai', 'anthropic', 'openrouter', 'groq', 'together', 'custom']

export const PLANS = ['FREE', 'PRO', 'PRO_MAX']

export const ADMIN_TABS = [
  { id: 'users', label: 'Pengguna' },
  { id: 'invoices', label: 'Invoice' },
  { id: 'analytics', label: 'Analitik' },
  { id: 'ops', label: 'Observability' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'ai', label: 'AI Log' },
  { id: 'keys', label: 'AI Keys' },
]

// ── Dashboard (Dashboard.jsx) ──────────────────────────────────────────────
export const PLAN_LABELS = {
  FREE: 'Gratis',
  PRO: 'Starter (Pro)',
  PRO_MAX: 'Pro (Pro Max)',
  ADMIN: 'Admin',
}
