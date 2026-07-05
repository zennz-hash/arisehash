# Free Deployment Notes

This project is configured for an initial free/Hobby deployment:

- Vercel function duration is set to 60 seconds in `vercel.json`.
- Supabase Postgres is used for the database.
- Gemini 3.5 Flash is the primary free-tier AI model in `AdminAiKey`.
- Unstable gateway models should stay inactive until their upstream service is healthy.

## Required Vercel Environment Variables

Set these for Production, Preview, and Development as needed:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `AI_KEY_SECRET`
- `GOOGLE_CLIENT_ID`
- `ADMIN_EMAILS`
- `CLIENT_ORIGIN`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_API_BASE`
- `VITE_SENTRY_DSN` optional
- `SENTRY_DSN` optional
- `RESEND_API_KEY` optional
- `EMAIL_FROM` optional

For Vercel rewrites, keep `VITE_API_BASE` empty.

## First Deployment Checklist

1. Push this repository to GitHub.
2. Create/import the project in Vercel.
3. Add the environment variables above.
4. Deploy.
5. Add the Vercel production URL to Google OAuth Authorized JavaScript origins.
6. Update `CLIENT_ORIGIN` to the production Vercel URL.
7. Redeploy after the OAuth and CORS URL changes.

## Post-Deploy Smoke Test

- `GET /api/health`
- Google login
- Chat with Gemini 3.5 Flash
- Build Code streaming
- Admin AI Keys page
