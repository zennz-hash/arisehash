# AriseHash

AriseHash adalah SaaS AI builder untuk menyusun rencana proyek, PRD teknis, diagram arsitektur, chat engineering, dan prototipe frontend interaktif di browser.

- **Frontend:** `app/` (React 18, Vite, Sandpack, multi-bahasa, PWA shell)
- **Backend:** `server/` (Express, Prisma, Neon/Postgres, Google OAuth, JWT session cookie, quota, audit log)
- **Serverless Vercel:** `api/index.mjs`

## Fitur Utama

- Generate PRD/blueprint dari ide aplikasi dengan kuis adaptif.
- Revisi PRD dengan AI dan riwayat versi.
- Chat AI dengan mode Standard dan Max Thinking.
- Workspace kode Sandpack untuk prototipe frontend React/Vue/Svelte/Vanilla.
- Auto-fix error Sandpack, snapshot versi kode, export ZIP, dan public share.
- Export ZIP menyertakan README dan `.env.example` dasar.
- Session management: lihat/cabut sesi aktif dan logout semua perangkat.
- Public code share dengan expiry, view count, dan opsi download publik.
- Kolaborator code project dengan role viewer/editor.
- BYOK model AI sendiri melalui endpoint OpenAI-compatible.
- Admin dashboard untuk user, plan manual, quota, audit log, AI log, observability, dan CSV export.
- Halaman legal dasar: Terms dan Privacy.
- Validasi ringan untuk output PRD dan file hasil AI.

Catatan: workspace kode saat ini menjalankan prototipe frontend di browser. Ini belum menjadi generator fullstack/backend production-ready.

## Jalankan Lokal

```bash
npm run install:all
npm run db:setup
npm run dev
```

Frontend berjalan di `http://localhost:5173`, backend di `http://localhost:4000`.

Salin `server/.env.example` ke `server/.env` dan `app/.env.example` ke `app/.env`, lalu isi `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, dan konfigurasi AI.

## Pemeriksaan

```bash
npm run build
npm run test
npm run db:validate
```

CI GitHub Actions tersedia di `.github/workflows/ci.yml`.

## Deploy

Panduan deploy Vercel + Neon ada di [DEPLOY.md](DEPLOY.md).
