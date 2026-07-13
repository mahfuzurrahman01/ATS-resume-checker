# Setup Guide

Steps you (the owner) do in external dashboards. All code is already wired to
these values via environment variables.

## 1. Gemini API key

1. Go to https://aistudio.google.com/app/apikey and create a key.
2. Put it in `.env.local` as `GEMINI_API_KEY`.

## 2. Supabase project (auth + database)

1. Create a project at https://supabase.com (free tier is fine).
2. **Project Settings → API** — copy into `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. **SQL Editor** — paste and run `supabase/migrations/0001_init.sql`.
   This creates the `profiles`, `credits`, `scans`, `payments` tables, RLS
   policies, and the trigger that provisions a profile + credits row on signup.

## 3. Google sign-in

1. In **Google Cloud Console** → APIs & Services → Credentials → create an
   **OAuth 2.0 Client ID** (type: Web application).
2. Authorized redirect URI — use the callback URL Supabase shows in the next
   step (looks like `https://<project>.supabase.co/auth/v1/callback`).
3. In **Supabase → Authentication → Providers → Google**: enable it, paste the
   Google **Client ID** and **Client Secret**, save.
4. In **Supabase → Authentication → URL Configuration**, set the Site URL:
   - local: `http://localhost:3000`
   - production: your deployed domain
   Add both to "Redirect URLs" as `<site>/auth/callback`.

## 4. Run

```bash
cp .env.example .env.local   # then fill in the values above
npm install
npm run dev
```

Open http://localhost:3000 and click **Sign in** — you should land back logged
in, with a credits badge in the navbar.

## Later: Stripe (payment phase)

Left blank for now. Will need `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
and `NEXT_PUBLIC_APP_URL`.
