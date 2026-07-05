# Deploy AriseHash ke Vercel

Repo ini berisi `app/` (React + Vite), `server/` (Express + Prisma), dan `api/index.mjs` sebagai handler serverless Vercel.

## 1. Siapkan Database Supabase

1. Buat atau buka project di Supabase.
2. Ambil dua connection string:
   - `DATABASE_URL`: pooled URL untuk runtime, biasanya port `6543`.
   - `DIRECT_URL`: direct URL untuk Prisma push/migrate, biasanya port `5432`.
3. Pastikan keduanya memakai `?sslmode=require`.

## 2. Siapkan Environment Lokal

```bash
cp .env.example .env
```

Atau set langsung di Vercel Dashboard. Lihat [.env.example](.env.example) untuk daftar lengkap.

**Variabel WAJIB:**

| Variabel | Deskripsi |
|----------|-----------|
| `DATABASE_URL` | Neon pooled PostgreSQL URL (`?sslmode=require`) |
| `DIRECT_URL` | Neon direct URL (tanpa pooler) |
| `JWT_SECRET` | String acak panjang (min 32 karakter) |
| `AI_KEY_SECRET` | Secret untuk enkripsi API key user |
| `GOOGLE_CLIENT_ID` | OAuth Web Client ID dari Google Cloud Console |
| `ADMIN_EMAILS` | Email admin, pisahkan koma |
| `CLIENT_ORIGIN` | Origin domains yang diizinkan CORS |
| `VITE_GOOGLE_CLIENT_ID` | Sama dengan `GOOGLE_CLIENT_ID` (untuk frontend) |

**AI Models (via seed script):**

Set `SEED_MIMO_KEY`, `SEED_UPBIT_KEY`, `SEED_QWEN_KEY`, `SEED_BYNARA_KEY`
di .env, lalu jalankan:

```bash
npm run install:all
npm run db:setup
npm run db:seed    # Isi AdminAiKey dari env vars
npm run dev
```

Atau konfigurasi model manual via Admin Panel → AI Keys setelah deploy.

Frontend:

```bash
VITE_GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
VITE_API_BASE=""      # Kosong = pakai proxy Vite (/api) atau rewrite Vercel
```

## 3. Deploy Vercel

`vercel.json` sudah mengatur:

- `installCommand`: `npm run install:all`
- `buildCommand`: `cd app && npm install && npm run build`
- `outputDirectory`: `app/dist`
- `/api/*` diarahkan ke `api/index.mjs`
- semua route non-API diarahkan ke SPA `index.html`

Di Vercel, isi environment variables dari `.env.example` di:
Settings → Environment Variables → tambahkan untuk Production & Preview

**Semua variabel yang diawali `VITE_` juga harus disertakan** — Vite membakarnya ke dalam bundle saat build.

| Key | Wajib? | Contoh |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Supabase pooled PostgreSQL URL (`:6543`, `?sslmode=require`) |
| `DIRECT_URL` | ✅ | Supabase direct PostgreSQL URL (`:5432`, `?sslmode=require`) |
| `JWT_SECRET` | ✅ | `openssl rand -base64 48` |
| `AI_KEY_SECRET` | ✅ | String acak (beda dengan JWT_SECRET) |
| `GOOGLE_CLIENT_ID` | ✅ | Dari Google Cloud Console |
| `ADMIN_EMAILS` | ✅ | `admin@example.com` |
| `CLIENT_ORIGIN` | ✅ | `https://arisehash.vercel.app` |
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Sama dengan GOOGLE_CLIENT_ID |
| `SEED_MIMO_KEY` | ⬜ | API key MiMo gateway |
| `SEED_UPBIT_KEY` | ⬜ | API key Upbit gateway |
| `SENTRY_DSN` | ⬜ | Dari Sentry dashboard |
| `RESEND_API_KEY` | ⬜ | Dari Resend dashboard |
| `VITE_API_BASE` | ⬜ | Kosongkan (pakai rewrite Vercel) |
| `VITE_SENTRY_DSN` | ⬜ | Dari Sentry dashboard |

> ⚠️ `maxDuration` di `vercel.json` sudah diset ke **300 detik** — cukup untuk streaming AI panjang.
> Pastikan akun Vercel Anda **Pro** atau lebih tinggi (Hobby max 60 detik).

## 4. Google OAuth

Di Google Cloud Console, tambahkan **Authorized JavaScript origins**:

- `http://localhost:5173` (development)
- `https://domain-vercel-anda.vercel.app` (production)
- URL preview Vercel jika perlu

**Authorized redirect URIs** tidak perlu diisi — AriseHash pakai One Tap / popup, bukan redirect flow.

## 5. Verifikasi

```bash
npm run build
npm run test        # 122+ test
npm run db:validate
```

Setelah deploy, cek endpoint berikut:

- `GET /api/health` — status server
- Login Google — test auth flow
- Generate PRD — test AI streaming
- Chat AI — test chat mode
- Build Code — test code workspace
- `/app/admin` — cuma untuk email di `ADMIN_EMAILS`
