# ATS Resume Checker — Architecture

A web app where signed-in users upload a resume (PDF) and get an AI-powered ATS
(Applicant Tracking System) compatibility analysis. A **general scan** gives a
score, issues, and skills. A **detailed report / job match** additionally
compares the resume to a pasted job description and rewrites weak bullet points.
Usage is metered with a **credit** system.

---

## 1. Tech stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS (dark theme, hardcoded `class="dark"`)
- **AI:** Google Gemini (`@google/genai`, model `gemini-2.5-flash`) — currently
  on the **free tier** (tight rate limits: ~20 requests/day)
- **Auth + DB + Storage:** Supabase (Postgres, Google OAuth, private file bucket)
- **PDF report export:** `jspdf` (client-side, lazy-loaded)
- **Hosting target:** Vercel
- **Animations:** GSAP (home hero)

---

## 2. Authentication

- **Google sign-in only**, via Supabase Auth (OAuth).
- Sign-in is **required for everything** — the homepage shows a sign-in panel
  (no uploader) when logged out.
- **Server-side enforced:** every API route calls `getCurrentUser()`; requests
  without a valid Supabase session cookie get `401`. This is the real security
  boundary — hiding the uploader in the UI is cosmetic only. Verified that
  `curl`/terminal/inspect cannot bypass it.
- Session is refreshed on each request by `src/middleware.ts` →
  `src/lib/supabase/middleware.ts`.
- A Postgres trigger (`handle_new_user`) auto-creates a `profiles` row and a
  `credits` row (10 free credits) when a new auth user signs up.

---

## 3. Credit / billing model

- **Signup bonus:** 10 free credits, no expiry.
- **Costs** (single source of truth in `src/lib/credit-costs.ts`):
  - General scan = **1 credit**
  - Detailed report / job match = **1 credit**
- **Invalid job description = 0 credits** (validated by the AI; any spent credit
  is refunded).
- **Failure refund:** if Gemini errors/times out after a credit was spent, the
  credit is automatically refunded.
- **Monthly free top-up** (`ensureMonthlyTopUp`, lazy — runs on scan activity):
  every 30 days, if balance < 3, top up to 3. Non-stacking; skipped for lifetime
  users. Purpose: keep the free tier genuinely useful for students/grads.
- **Lifetime flag:** `credits.is_lifetime = true` → unlimited, no deduction.
- **Payments (Stripe): NOT built yet.** Planned one-time credit packs
  (~14/$5, 35/$10) + lifetime (~$39). No recurring subscription.

---

## 4. Data model (Supabase Postgres)

Migrations live in `supabase/migrations/`. All tables use Row Level Security so
a user can only read/write their own rows; privileged writes (granting/refunding
credits) use the service-role key which bypasses RLS.

- **`profiles`** — `id` (= auth.users id), `email`, `full_name`, `avatar_url`.
- **`credits`** — `user_id`, `balance` (int), `is_lifetime` (bool),
  `last_free_topup_at` (timestamptz).
- **`scans`** — one row per analysis run:
  - `id`, `user_id`, `created_at`, `score` (int)
  - `is_detailed` (bool), `jd_provided` (bool)
  - `file_hash` (sha256 of the PDF — used to group scans into "resumes" and to
    cache)
  - `storage_path`, `file_name` (the stored PDF)
  - `result` (jsonb — the full AI analysis; see `ResumeData` type)
- **`payments`** — reserved for Stripe (unused yet): `stripe_session_id`,
  `amount_cents`, `credits_granted`, `is_lifetime`.
- **Storage bucket `resumes`** (private): PDFs stored at
  `resumes/<user_id>/<file_hash>.pdf`. RLS restricts each user to their folder.

### "Resume" vs "scan"
A **scan** = one AI run. A **resume** = a unique uploaded file (grouped by
`file_hash`). The same resume can have many scans: one general scan + multiple
job matches over time. `getUserResumes()` groups scans by `file_hash` into
`ResumeGroup` objects, each carrying a representative result + a list of its
job matches.

---

## 5. Routes

### Pages (App Router, `src/app`)
- **`/`** — Home. Logged out → sign-in panel. Logged in → optional
  job-description box + PDF uploader → results (general or job match) → detailed
  report CTA → downloadable PDF.
- **`/profile`** — "My Resumes" dashboard (server-guarded; redirects if not
  signed in). Lists resumes grouped by file, with filter tabs
  **All / Not matched / Matched**. Open a resume → view analysis, preview/
  download the original PDF, run new job matches, browse past matches.
- **`/about`**, **`/contact`** — static marketing pages.
- **`/auth/callback`**, **`/auth/signout`** — OAuth session handling.

> Note: routing is currently minimal (most flow lives on `/` and `/profile`).
> A planned improvement is to split into cleaner routes (e.g. `/upload`,
> `/resumes`, per-resume pages). Not done yet.

### API routes (`src/app/api`)
- **`POST /api/process-resume`** — main scan endpoint. Auth required. Accepts a
  PDF + `mode` (`basic|detailed`) + optional `jobDescription`. Validates,
  charges credits, calls Gemini, stores the PDF + records the scan, returns the
  analysis + updated credit balance.
- **`POST /api/scans/[id]/detailed`** — run a fresh **job match** on a
  previously uploaded resume (loads the stored PDF, charges 1 credit).
- **`GET /api/scans/[id]/file`** — redirects to a short-lived signed URL to
  **preview** (or `?download=1` to download) the user's stored PDF. Ownership
  verified first.
- **`GET /api/credits`** — returns the current credit balance (for refresh).

---

## 6. Request flow: a scan

1. Client (`src/app/page.tsx`) sends the PDF + `mode` + optional JD to
   `POST /api/process-resume` as `multipart/form-data`.
2. Route: **rate limit** by IP (`src/lib/rate-limit.ts`, in-memory) → **auth
   check** → validate file (PDF MIME + magic bytes `%PDF`, ≤10MB).
3. **Cache:** for a basic scan, if the same `file_hash` was scanned in the last
   24h, return the cached result with no charge (saves Gemini quota).
4. **Top-up** any due monthly free credits, then **spend** the cost
   (`spendCredits`). If insufficient → `402 OUT_OF_CREDITS`.
5. Call **Gemini** (`GeminiService.processResumeWithGemini`) with a structured
   JSON prompt. Detailed mode appends instructions for parse preview + bullet
   rewrites + (if JD given) job match.
6. **Error handling:** raw provider errors are mapped to friendly messages by
   `friendlyGeminiError()` (429/quota, timeout, 503, safety, etc.); the credit
   is refunded on failure. Invalid JD → `422`, refunded, "not charged" message.
7. On success: **upload the PDF** to the private bucket, **record the scan** in
   Postgres, and return `{ data, credits }`.
8. Client renders results (`ResultsDisplay`, `ProSuggestions`, `DetailedReport`)
   and updates the credit badge from the returned balance.

---

## 7. Gemini integration (`src/lib/gemini-service.ts`)

- Single prompt returns a strict JSON object typed as `ResumeData`:
  - Always: `header`, `sections` (experience/education/skills/certs),
    `ats_analysis` (score, issues, recommendations, keywords),
    `pro_suggestions`.
  - Detailed only: `parse_preview`, `bullet_rewrites[]`, and (if a JD was
    given) `jd_match` (`job_title`, `match_score`, matched/missing keywords,
    `title_alignment`, `summary`).
  - Guardrails: `is_resume` (rejects non-resumes), `jd_invalid` (rejects
    non-job-description text).
- Uses `responseMimeType: "application/json"` and a timeout wrapper
  (basic 60s, detailed 110s).
- **Client-side pre-check** (`looksLikeJobDescription` in `src/lib/utils.ts`)
  leniently blocks obviously-invalid JD text (too short / pure code) before it
  reaches the server, to save quota. The AI is the final validator.

---

## 8. State management (frontend)

- **Credits** use a small React Context (`src/lib/credits-context.tsx`):
  - Seeded server-side in `src/app/layout.tsx` (correct on first paint).
  - APIs return the updated balance in their responses; the client calls
    `setCredits()` so the navbar/profile badges update **instantly, no reload**.
  - `GET /api/credits` + `refresh()` exist as a fallback.
- No Redux/Zustand — Context is sufficient at this scale.

---

## 9. Security summary

- All API routes require a valid Supabase session (server-side).
- File validated by MIME **and** magic bytes; 10MB cap.
- AI-supplied URLs sanitized (`safeUrl`) to block `javascript:`/`data:` XSS.
- Security headers set globally in `next.config.ts` (nosniff, X-Frame-Options,
  Referrer-Policy).
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are **server-only** (never
  shipped to the browser).
- Per-IP rate limiting (in-memory; should move to Redis/DB for multi-instance
  production).
- Resume PDFs live in a **private** bucket, accessed only via short-lived signed
  URLs after ownership checks.

---

## 10. Key files

```
src/
  app/
    layout.tsx                     # root layout, seeds CreditsProvider
    page.tsx                       # home: sign-in gate OR upload+results
    profile/page.tsx               # server: loads grouped resumes
    api/
      process-resume/route.ts      # main scan endpoint
      scans/[id]/detailed/route.ts # re-run job match on a stored resume
      scans/[id]/file/route.ts     # signed URL preview/download
      credits/route.ts             # current balance
      ... auth/callback, auth/signout
  components/
    SignInGate.tsx                 # logged-out home panel
    FileUpload.tsx                 # drag/drop PDF uploader
    ResultsDisplay.tsx             # basic analysis UI
    ProSuggestions.tsx             # category suggestions
    DetailedReport.tsx             # job match + parse preview + rewrites (+CTA)
    ProfileClient.tsx              # "My Resumes" dashboard (tabs, detail, matches)
    Navbar.tsx / AuthButton.tsx / CreditsNavBadge.tsx
    ui/                            # button, card, badge, credit-badge, error-notice, ...
  lib/
    gemini-service.ts             # Gemini calls, prompt, ResumeData type, error mapping
    scans.ts                      # scans/resumes CRUD, credits spend/refund/topup, storage
    auth.ts                       # getCurrentUser, getUserCredits, isAuthConfigured
    credit-costs.ts               # CREDIT_COST single source of truth
    credits-context.tsx           # client credits context
    rate-limit.ts                 # in-memory IP rate limiter
    utils.ts                      # cn, safeUrl, displayUrl, looksLikeJobDescription
    supabase/{client,server,middleware}.ts
supabase/migrations/              # 0001 init, 0002 resume storage, 0003 credit model
```

---

## 11. Environment variables

```
GEMINI_API_KEY                 # server-only Gemini key
NEXT_PUBLIC_SUPABASE_URL       # public
NEXT_PUBLIC_SUPABASE_ANON_KEY  # public
SUPABASE_SERVICE_ROLE_KEY      # server-only secret (bypasses RLS)
UPSTASH_REDIS_REST_URL         # distributed rate limiting; falls back to
UPSTASH_REDIS_REST_TOKEN       #   in-memory (not multi-instance safe) if unset
# Stripe vars reserved for later
```

---

## 12. Status / roadmap

**Done:** security hardening; PDF-only pipeline; native jsPDF report; Supabase
auth (Google) + accounts; credit model with monthly top-up; general scan +
detailed report (job match, ATS parse preview, bullet rewriter); invalid-JD
rejection with refund; "My Resumes" dashboard grouped by file with tabs,
preview/download, and per-resume job matches; job description at upload time;
real-time credit badge; friendly error handling.

**Not done yet:**
- **Stripe payments** (buy credit packs / lifetime) — the whole earning layer.
- **Route cleanup** (dedicated `/upload`, `/resumes`, per-resume pages).
- **Professional UI redesign** (home still has placeholder marketing bits like
  a "3+ New Features" banner and a "100% Free" stat that now contradicts the
  credit model).
- Production-grade rate limiting (move off in-memory).
- Gemini paid tier for real traffic (free tier ~20 req/day is the current
  bottleneck).

**Current branch:** `hardening/security-pdf-cleanup` (not merged to `main`).

---

## 13. How it works right now — the story

A visitor lands on the homepage and sees a sign-in panel — nothing else, because
the product is fully gated. They sign in with Google (one click), and Supabase
creates their account behind the scenes, along with a wallet of 10 free credits.
Now the real app appears: an uploader with an optional box where they can paste a
job description before uploading. If they just drop their resume PDF, they spend
1 credit and get a **general ATS scan** — a compatibility score, the issues
holding the resume back, extracted skills, and improvement suggestions. If they
paste a job posting first, that same upload instead becomes a **job match** (still
1 credit): on top of the general analysis, they see how well the resume fits that
specific job, which keywords are present or missing, and AI-rewritten versions of
their weakest bullet points. Behind the scenes the PDF is verified, the credit is
charged, Gemini analyzes the document, the original file is stored privately, and
the run is recorded — and if anything fails (quota, timeout, or a fake job
description), the credit is refunded and the user sees a clean, human-readable
message instead of a raw error.

Every scan is saved, so the user can come back anytime to **My Resumes**. There,
their uploads are grouped by file (not by every run), with tabs to filter between
resumes they've matched to a job and ones they haven't. Opening a resume shows its
analysis again, lets them preview or download the actual PDF they uploaded, and —
most importantly — lets them **match that same resume against a new job** whenever
they want, each match costing 1 credit and getting saved as its own labeled entry
(e.g. "Senior Frontend Engineer — 72%") under that resume. The credit balance in
the navbar updates instantly after every action, no reload needed. When the free
credits run low, an active user quietly gets topped back up to 3 each month; when
they run out for good, the plan is to let them buy more through Stripe — the one
piece not built yet. In short: sign in → scan or match → manage everything from a
personal dashboard, all metered by a simple credit system designed to stay
generous to genuine job seekers while protecting the (currently free-tier) AI
quota.
```
