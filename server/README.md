# AriseHash Backend API

Backend memakai Express + Prisma + Postgres untuk auth, blueprint PRD, chat AI, code project Sandpack, quota, BYOK model, audit log, dan admin dashboard.

## Menjalankan Lokal

```bash
cd server
npm install
npm run db:validate
npx prisma db push
npm run dev
```

API berjalan di `http://localhost:4000`.

## Environment

Lihat `server/.env.example`. Minimal:

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Postgres pooled URL |
| `DIRECT_URL` | Postgres direct URL |
| `JWT_SECRET` | Secret untuk session JWT cookie |
| `AI_KEY_SECRET` | Secret enkripsi API key user (BYOK) |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID |
| `ADMIN_EMAILS` | Email admin, pisahkan koma |
| `CLIENT_ORIGIN` | Origin frontend yang diizinkan CORS |
| `AI_STANDARD_*` | Gateway model Standard |
| `AI_MAX_*` | Gateway model Max |

## Endpoint Utama

- `POST /api/auth/google`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET|POST /api/blueprints`
- `POST /api/blueprints/generate`
- `POST /api/blueprints/:id/revise`
- `GET|POST /api/code-projects`
- `POST /api/code-projects/:id/stream`
- `GET|POST /api/chat`
- `POST /api/chat/:id/message`
- `GET|POST /api/ai-keys`
- `GET /api/quota`
- `GET /api/admin/*`

## Keamanan

- Google ID token diverifikasi server-side.
- Session memakai JWT di cookie httpOnly plus record `AuthSession` di database.
- Logout merevoke session aktif dan menghapus cookie.
- Request mutasi berbasis cookie wajib membawa header `X-CSRF-Token`.
- Endpoint AI mahal memakai rate limit dan quota.
- API key user dienkripsi dengan AES-256-GCM menggunakan `AI_KEY_SECRET`.
- BYOK `baseUrl` divalidasi untuk mencegah localhost/private IP dan wajib HTTPS di produksi.

## Test

```bash
npm test
```
