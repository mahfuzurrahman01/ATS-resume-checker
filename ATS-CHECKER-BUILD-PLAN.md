# ATS Checker — Production Build Plan

**How to use this file**

- Work top to bottom. The phases are ordered by *dependency*, not by fun.
- Each step has: **Goal** → **Prompt for Claude Code** (copy the block) → **Done when**.
- After every step: run the app, click through it, then commit. One commit per step.
- Never start a step if the previous step's "Done when" is not true.

**Ground rules to tell Claude Code once, at the start of every session:**

```
Read ARCHITECTURE.md first. We are refactoring this project for production.

Rules for this whole session:
- Make the smallest change that fully accomplishes the task. No drive-by refactors.
- Do not touch files outside the ones needed for the task.
- TypeScript strict. No `any`. No non-null assertions unless you explain why.
- Do not add new dependencies without telling me the package name and why.
- After each change, run `npx tsc --noEmit` and fix type errors before finishing.
- When you finish, print a short summary: files changed, what to test manually.
- If a requirement is ambiguous, ASK me. Do not guess and build the wrong thing.
```

---

## Phase 0 — Set the foundation (do not skip)

### Step 0.1 — Branch + freeze the vocabulary

**Goal:** Kill the word "detailed report" from the codebase forever. From now on there are only two things: **Scan** and **Match**.

**Prompt for Claude Code:**

```
We are renaming a core product concept. Read ARCHITECTURE.md for context.

The product currently has three fuzzy concepts: "general scan", "detailed report",
and "job match". We are collapsing these into exactly TWO:

1. SCAN  — analysis of a resume BY ITSELF. No job description involved. Costs 1 credit.
2. MATCH — analysis of a resume AGAINST a specific job description. Costs 2 credits.

"Detailed report" no longer exists as a concept. Anything that was in the detailed
report and does NOT need a job description belongs to SCAN. Anything that DOES need a
job description belongs to MATCH.

TASK: Do a repo-wide audit only — DO NOT change code yet. Produce a markdown report at
`docs/rename-audit.md` listing:
- Every file + line where "detailed", "isDetailed", "is_detailed", "detailedReport",
  "jdProvided", "jd_provided", or "pro suggestions" appears.
- For each occurrence, your recommendation: does it become SCAN, become MATCH, or get deleted?
- Any place where the two concepts are tangled together in one function.

Then stop and show me the report. I will approve before you change anything.
```

**Done when:** you have read `docs/rename-audit.md` and you agree with it. This report is your map for everything after.

---

### Step 0.2 — The database migration

**Goal:** Split `scans` into `resumes` + `scans` + `matches`, and add a `credit_ledger`.

Why the ledger matters: right now you mutate `credits.balance` directly. The first time a paying user says "I lost a credit," you cannot answer them. A ledger is append-only and auditable. **Build it before Stripe, not after.**

**Prompt for Claude Code:**

```
Write a new Supabase migration: `supabase/migrations/0004_scan_match_split.sql`.

We are restructuring the data model. Currently one `scans` table does everything.
New model:

resumes  — a unique uploaded file, one row per (user_id, file_hash)
  id uuid pk
  user_id uuid not null references auth.users
  file_hash text not null            -- sha256 of the PDF
  file_name text not null            -- original filename as uploaded
  display_name text                  -- user-editable label, nullable
  storage_path text not null
  page_count int
  has_text_layer boolean not null default true
  created_at timestamptz default now()
  UNIQUE (user_id, file_hash)        -- dedupe is enforced at the DB level

scans    — one AI analysis of a resume, no job description
  id uuid pk
  resume_id uuid not null references resumes on delete cascade
  user_id uuid not null
  score int not null                 -- 0-100, computed in code, deterministic
  subscores jsonb not null           -- {parseability, structure, contact, content, formatting}
  result jsonb not null
  model_version text not null
  prompt_version text not null
  created_at timestamptz default now()

matches  — one AI analysis of a resume against a job description
  id uuid pk
  resume_id uuid not null references resumes on delete cascade
  user_id uuid not null
  jd_text text not null
  jd_hash text not null
  job_title text
  company text
  match_score int not null
  result jsonb not null
  model_version text not null
  prompt_version text not null
  created_at timestamptz default now()

credit_ledger — append-only. NEVER updated or deleted.
  id uuid pk
  user_id uuid not null
  delta int not null                 -- negative = spend, positive = grant/refund
  reason text not null               -- 'signup_bonus'|'monthly_topup'|'scan'|'match'|'refund'|'purchase'
  ref_type text                      -- 'scan'|'match'|'payment'|null
  ref_id uuid
  balance_after int not null         -- snapshot for fast reads + audit
  created_at timestamptz default now()

REQUIREMENTS:
- Row Level Security on all four tables: a user can only SELECT their own rows.
- No user-facing INSERT/UPDATE/DELETE policy on credit_ledger — writes go through the
  service role only.
- Index: resumes(user_id, created_at desc), scans(resume_id), matches(resume_id),
  credit_ledger(user_id, created_at desc).
- Keep the existing `credits` table as a fast cache of the balance, but it must now be
  written ONLY inside the same transaction as a credit_ledger insert.
- Write a Postgres function `spend_credits(p_user_id uuid, p_amount int, p_reason text,
  p_ref_type text, p_ref_id uuid)` that:
    - locks the credits row (SELECT ... FOR UPDATE)
    - returns an error if balance < amount AND is_lifetime is false
    - inserts a credit_ledger row and updates credits.balance atomically
    - returns the new balance
  And a matching `grant_credits(...)` for refunds/top-ups/purchases.
- Write a DATA MIGRATION section that backfills resumes/scans/matches from the existing
  `scans` table: group existing rows by (user_id, file_hash) into resumes; rows where
  jd_provided = true become matches; the rest become scans.
- Also seed credit_ledger with one 'migration_opening_balance' row per existing user so
  the ledger sums to their current balance.

Do NOT drop the old `scans` table in this migration. Rename it to `scans_legacy_v1`.
We delete it in a later migration once we've verified the backfill.
```

**Done when:** migration applies cleanly on a local Supabase, and `SELECT sum(delta) FROM credit_ledger GROUP BY user_id` equals each user's `credits.balance`. Verify that before moving on.

---

## Phase 1 — Make the product trustworthy

This is the most important phase in the whole document. Everything else is polish.

### Step 1.1 — Extract text before Gemini ever sees the file

**Goal:** Stop sending raw PDFs to Gemini. Extract the text yourself first.

You get four wins at once: you can detect scanned/image-only PDFs for free, you can reject non-resumes before charging a credit, your Gemini calls get dramatically cheaper and faster, and your deterministic checks become possible.

**Prompt for Claude Code:**

```
Create `src/lib/pdf/extract.ts`.

Add the `unpdf` package (it's serverless-safe, works on Vercel — pdf-parse is not).

Export an async function:

  extractPdf(buffer: Buffer): Promise<PdfExtraction>

  type PdfExtraction = {
    text: string              // full plain text, all pages joined
    pages: string[]           // text per page
    pageCount: number
    wordCount: number
    hasTextLayer: boolean     // false if the PDF is a scan/image with no extractable text
    charCountPerPage: number[]
  }

RULES:
- hasTextLayer = false when total extracted characters < 100. That means the PDF is an
  image scan and NO ATS on earth can read it — this is a real, valuable finding.
- Never throw on a malformed PDF. Return a result with hasTextLayer: false and empty text.
- Do not call any AI here. This file is pure, deterministic, and unit-testable.

Also write `src/lib/pdf/extract.test.ts` with tests using small fixture PDFs.
```

**Done when:** you can feed it a normal PDF and a screenshot-exported PDF, and it correctly reports `hasTextLayer: true` / `false`.

---

### Step 1.2 — Deterministic checks (the real ATS rules)

**Goal:** Compute in *code* the things that are objectively true or false. The AI does not get a vote on these.

This is the heart of the fix. Real ATS parsers fail on specific, mechanical things — and those things are checkable without an LLM.

**Prompt for Claude Code:**

```
Create `src/lib/analysis/checks.ts`.

Pure, deterministic ATS checks. Input: the PdfExtraction from src/lib/pdf/extract.ts.
NO AI CALLS IN THIS FILE. Same input must always produce the same output.

Export:

  runChecks(extraction: PdfExtraction): CheckResult[]

  type CheckResult = {
    id: string                  // stable slug, e.g. 'no-text-layer'
    category: 'parseability' | 'structure' | 'contact' | 'content' | 'formatting'
    severity: 'critical' | 'high' | 'medium' | 'low'
    passed: boolean
    title: string               // "Resume has no readable text layer"
    detail: string              // one sentence explaining what we found
    fix: string                 // one sentence: what the user should do
    evidence?: string           // the offending snippet, if any
  }

IMPLEMENT THESE CHECKS (each returns exactly one CheckResult):

parseability:
- no-text-layer            — hasTextLayer is false. CRITICAL.
- too-few-words            — wordCount < 150. HIGH.
- too-many-words           — wordCount > 1200. MEDIUM.
- excessive-pages          — pageCount > 2. MEDIUM.

contact:
- missing-email            — no email regex match. CRITICAL.
- missing-phone            — no phone-like number. HIGH.
- missing-linkedin         — no linkedin.com/in/ URL. MEDIUM.
- contact-in-header-footer — email/phone appear only in the first or last 5% of the text
                             AND the pdf has repeated identical lines across pages
                             (a real header/footer). Many ATS drop headers. HIGH.

structure:
- missing-section          — one check per required section. Detect by looking for common
                             heading variants, case-insensitive:
                               experience: experience|employment|work history|professional experience
                               education:  education|academic
                               skills:     skills|technical skills|technologies|competencies
                             Missing experience or education = HIGH. Missing skills = MEDIUM.
- nonstandard-headings     — headings found but with creative names ("My Journey",
                             "What I Bring"). MEDIUM.

content:
- no-quantified-bullets    — fewer than 20% of bullet lines contain a digit or %. HIGH.
- weak-verb-openers        — bullets starting with weak openers (Responsible for,
                             Worked on, Helped with, Assisted, Involved in, Duties
                             included). HIGH. Put the offending lines in `evidence`.
- first-person-pronouns    — "I ", "my ", "me " appear in bullets. LOW.
- dates-unparseable        — fewer than 2 lines match a date range pattern
                             (e.g. "Jan 2022 - Mar 2024", "2022–2024", "2022 - Present"). HIGH.

formatting:
- likely-multi-column      — heuristic: a high rate of lines under 30 characters combined
                             with large horizontal gaps in the raw text. MEDIUM.
                             Be conservative — false positives here are embarrassing.
- special-chars-in-contact — non-ASCII glyphs / icon-font artifacts near the contact
                             block (these render as gibberish in text-only ATS). MEDIUM.
- tables-detected          — repeated runs of 3+ spaces or tab characters forming columns.
                             MEDIUM.

Write `src/lib/analysis/checks.test.ts` covering each check with a passing and a failing
fixture. This file MUST have tests — it is the source of truth for our score.
```

**Done when:** `npm test` passes and you can run the same resume through `runChecks` ten times and get byte-identical output.

---

### Step 1.3 — The scoring rubric (deterministic, in code)

**Goal:** The same resume must always get the same score. Right now it does not — your own screenshot shows the same `Resume.pdf` scoring 70, 75, and 80. That single inconsistency will destroy user trust faster than any bug.

**Prompt for Claude Code:**

```
Create `src/lib/analysis/score.ts`.

The AI must NEVER produce the final score. The score is computed here, in code, from
the CheckResult[] produced by src/lib/analysis/checks.ts.

Export:

  computeScore(checks: CheckResult[]): ScoreBreakdown

  type ScoreBreakdown = {
    total: number                   // 0-100, integer
    band: 'critical' | 'needs-work' | 'good' | 'excellent'
    subscores: {
      parseability: { earned: number; max: 30 }
      structure:    { earned: number; max: 20 }
      contact:      { earned: number; max: 15 }
      content:      { earned: number; max: 25 }
      formatting:   { earned: number; max: 10 }
    }
  }

RUBRIC:
- Category maxes: parseability 30, structure 20, contact 15, content 25, formatting 10.
  Total 100.
- Within a category, each failed check deducts points by severity:
    critical = the entire category drops to 0
    high     = -40% of the category max
    medium   = -20% of the category max
    low      = -10% of the category max
  Floor each category at 0.
- HARD RULE: if the `no-text-layer` check fails, total score is 0 regardless of anything
  else. An ATS literally cannot read the file. Set band to 'critical'.
- Bands: 0-39 critical, 40-64 needs-work, 65-84 good, 85-100 excellent.

Export the rubric weights as a plain exported const so the UI can SHOW the user the
breakdown ("Parseability 24/30"). Transparency is the feature — we are not a black box.

Write tests. Same checks in -> same score out, every time.
```

**Done when:** scanning the same file twice returns the identical number. Test it. This is your credibility.

---

### Step 1.4 — Rewrite the Gemini prompts

**Goal:** Gemini's job shrinks. It no longer scores. It no longer invents "missing keywords" out of thin air. It does the one thing an LLM is actually good at: **judgment about language and content.**

Create two separate prompts. They are different products.

**Prompt for Claude Code:**

```
Rewrite `src/lib/gemini-service.ts`. Split it into:

  src/lib/ai/client.ts        — the Gemini client, timeout wrapper, error mapping
  src/lib/ai/scan-prompt.ts   — SCAN prompt + zod schema + types
  src/lib/ai/match-prompt.ts  — MATCH prompt + zod schema + types

REQUIREMENTS FOR BOTH:
- Input is the EXTRACTED TEXT (string), not the PDF file. We already extracted it.
- temperature: 0. topP: 1. responseMimeType: "application/json".
- Validate every response with zod. If validation fails, retry ONCE, then throw.
  Never ship an unvalidated LLM response to the UI.
- Export PROMPT_VERSION = 'scan-v1' / 'match-v1'. Store it on every row (we need this
  to invalidate caches when we change a prompt).
- The AI NEVER returns a score for the scan. Scoring is done in src/lib/analysis/score.ts.
- The AI DOES return a match_score for matches (0-100), because keyword overlap against a
  JD is genuinely a judgment call. But also compute a deterministic keyword-overlap
  percentage in code and show BOTH.

I will paste the two exact system prompts in my next message. Build the scaffolding,
the zod schemas, and the client first.
```

Then, in a second message, paste this:

**The SCAN system prompt (copy into `scan-prompt.ts`):**

```
You are an expert resume reviewer and ATS (Applicant Tracking System) specialist.

You will receive the plain text extracted from a candidate's resume, plus a list of
mechanical checks that have ALREADY been computed deterministically by our system.

YOUR JOB is the part a machine cannot do: judge the QUALITY OF THE WRITING AND CONTENT.

CRITICAL RULES:
1. Do NOT output any score. Scoring is handled by our system. If you output a score it
   will be discarded.
2. Do NOT invent "missing keywords". Without a job description there is no such thing as
   a missing keyword. Never speculate about what a hypothetical employer might want.
3. Only describe what is ACTUALLY IN the resume text. Never infer, assume, or embellish.
   If the resume does not mention a technology, do not mention it.
4. Every rewrite you suggest must use only facts present in the original text. You may
   restructure, sharpen, and add strong verbs. You may NOT invent metrics, numbers,
   percentages, company names, or achievements. If a bullet lacks a metric, your rewrite
   should include a clearly-marked placeholder like [X%] and tell the user to fill it in.
   Fabricating a number on someone's resume could cost them a job. Never do it.
5. Be specific and blunt. "Improve your bullet points" is useless. "Your bullet 'Worked on
   the ERP system' names no technology, no scale, and no outcome" is useful.

Return ONLY a JSON object matching this exact shape, with no markdown fences and no
preamble:

{
  "is_resume": boolean,
  "rejection_reason": string | null,

  "header": {
    "name": string | null,
    "title": string | null,
    "email": string | null,
    "phone": string | null,
    "location": string | null,
    "links": [{ "label": string, "url": string }]
  },

  "sections": {
    "experience": [{
      "company": string,
      "role": string,
      "dates": string,
      "bullets": string[]
    }],
    "education": [{ "institution": string, "credential": string, "dates": string }],
    "skills": { "technical": string[], "soft": string[] },
    "certifications": string[]
  },

  "content_findings": [{
    "category": "impact" | "clarity" | "specificity" | "seniority" | "consistency",
    "severity": "high" | "medium" | "low",
    "finding": string,
    "evidence": string,
    "fix": string
  }],

  "bullet_rewrites": [{
    "original": string,
    "rewritten": string,
    "why": string,
    "needs_user_input": boolean
  }],

  "summary": string
}

Return at most 6 content_findings and at most 5 bullet_rewrites. Choose the ones with the
highest impact. Quality over quantity — a user will act on 3 great suggestions and ignore
15 mediocre ones.

Set is_resume to false if the text is clearly not a resume (an essay, a contract, code,
random text). In that case set rejection_reason and leave everything else empty.
```

**The MATCH system prompt (copy into `match-prompt.ts`):**

```
You are an expert technical recruiter and ATS specialist.

You will receive (a) the plain text of a candidate's resume and (b) the plain text of a
job description. Judge how well this specific candidate fits this specific role.

CRITICAL RULES:
1. Ground every claim in the actual text. Never invent skills the candidate does not have,
   and never invent requirements the job description does not state.
2. A "missing keyword" is ONLY a term that appears in the job description and does NOT
   appear in the resume. Nothing else qualifies.
3. Distinguish MUST-HAVES from NICE-TO-HAVES. A missing must-have is a real problem. A
   missing nice-to-have is noise. Do not present them as equally important.
4. Rewrites must use only facts present in the original resume. You may re-frame existing
   experience to speak to the job's language. You may NOT fabricate experience, metrics,
   or technologies. Use [X%] placeholders where a number is needed but not present.
5. Be honest about a bad fit. If the candidate is not qualified, say so plainly and
   explain what is missing. A false "82% match" that leads to a rejection is worse than
   an honest "41% — you're missing the core requirement."

Return ONLY a JSON object matching this exact shape, no markdown fences, no preamble:

{
  "jd_valid": boolean,
  "rejection_reason": string | null,

  "job": {
    "title": string | null,
    "company": string | null,
    "seniority": "intern" | "junior" | "mid" | "senior" | "lead" | "unclear"
  },

  "match_score": number,
  "verdict": "strong" | "possible" | "stretch" | "not-a-fit",
  "verdict_reason": string,

  "title_alignment": {
    "resume_title": string | null,
    "aligned": boolean,
    "note": string
  },

  "requirements": [{
    "requirement": string,
    "type": "must-have" | "nice-to-have",
    "status": "met" | "partial" | "missing",
    "evidence": string | null
  }],

  "keywords": {
    "matched": string[],
    "missing_critical": string[],
    "missing_optional": string[]
  },

  "bullet_rewrites": [{
    "original": string,
    "rewritten": string,
    "why": string,
    "needs_user_input": boolean
  }],

  "tailored_summary": string,

  "biggest_gap": string
}

Set jd_valid to false if the provided text is not a job description (it's a resume, code,
random text, or under 100 words of real job content). Set rejection_reason and leave the
rest empty. The user will not be charged.

Return at most 12 requirements and at most 6 bullet_rewrites, prioritized by importance.
```

**Done when:** both prompts return zod-valid JSON on 5 different real resumes, and the scan prompt never returns a score or a "missing keyword".

---

## Phase 2 — Rebuild the request flow

### Step 2.1 — The scan pipeline

**Prompt for Claude Code:**

```
Rewrite the scan endpoint as `POST /api/scans` (delete /api/process-resume).

THE ORDER OF OPERATIONS MATTERS. Implement exactly this:

1.  Auth. No session -> 401. (Server-side, always.)
2.  Rate limit by user_id (not IP — IP is wrong behind Vercel's edge).
3.  Read the file. Validate: PDF MIME + %PDF magic bytes + <= 10MB. Else 400.
4.  Hash the bytes (sha256) -> file_hash.
5.  DEDUPE: if a `resumes` row exists for (user_id, file_hash), do NOT create a new one
    and do NOT charge. Return 200 with { duplicate: true, resume_id, latest_scan_id }.
    The UI will ask the user whether they want to view the existing scan (free) or
    force a re-scan (1 credit, via ?force=true).
6.  Extract text (src/lib/pdf/extract.ts).
7.  Run deterministic checks (src/lib/analysis/checks.ts).
8.  GUARDRAIL, BEFORE CHARGING: if the extracted text is obviously not a resume
    (wordCount < 50), return 422 with a clear message. NO CREDIT CHARGED.
9.  Call Gemini with the SCAN prompt.
10. If Gemini returns is_resume: false -> 422, clear message. NO CREDIT CHARGED.
11. ONLY NOW, on a fully valid result: charge 1 credit via the spend_credits() Postgres
    function. If insufficient -> 402 OUT_OF_CREDITS (and we throw away the AI result;
    that's fine, it's cheap, and it's better than a bad refund flow).
12. Compute the score (src/lib/analysis/score.ts).
13. Upload the PDF to private storage. Insert the `resumes` row and the `scans` row.
14. Return { resume_id, scan_id, score, subscores, checks, ai, credits }.

NOTE THE CHANGE: we charge AFTER success, not before. This removes the entire
spend-then-refund dance and its race conditions. Delete the refund-on-failure code path
for scans — it is no longer reachable.

If anything throws between step 11 and 13, refund via grant_credits() with
reason 'refund'. Log it loudly.

CACHING: cache by (file_hash, prompt_version, model_version) PERMANENTLY, not 24h. The
file did not change, so the answer must not change. If a cached scan exists for that exact
triple, return it free.
```

**Done when:** uploading the same PDF twice charges exactly 1 credit total, and an invalid file charges 0.

---

### Step 2.2 — The match pipeline

**Prompt for Claude Code:**

```
Create `POST /api/resumes/[resumeId]/matches`.

Body: { jobDescription: string }

Order of operations:
1.  Auth. Verify the user OWNS this resume_id. 404 (not 403) if not — do not leak existence.
2.  Rate limit by user_id.
3.  Cheap local validation of the JD: >= 100 words, contains at least 2 of these signals:
    a requirements/responsibilities heading, "years of experience", "we are looking",
    "you will", a seniority word. If it fails -> 422, NO CREDIT CHARGED, message:
    "That doesn't look like a job description."
4.  Hash the JD. If a match already exists for (resume_id, jd_hash, prompt_version),
    return it free. Same JD + same resume = same answer.
5.  Load the stored PDF, extract text (or better: cache the extracted text on the
    `resumes` row so we never re-extract — add a `extracted_text` column).
6.  Call Gemini with the MATCH prompt.
7.  If jd_valid: false -> 422. NO CREDIT CHARGED.
8.  ONLY NOW charge 2 credits via spend_credits().
9.  Also compute a deterministic keyword overlap % in code (simple token intersection
    against the JD's noun phrases) and store it alongside the AI's match_score. We show
    both: "AI assessment: 68% · Keyword overlap: 54%".
10. Insert the `matches` row. Return { match_id, ...result, credits }.

Refund on any failure after step 8.
```

**Done when:** the same JD + resume twice charges 2 credits total, and garbage JD text charges 0.

---

## Phase 3 — Routing and pages

### Step 3.1 — Split the routes

**Prompt for Claude Code:**

```
Restructure the App Router. Currently everything lives on `/` and `/profile`. New structure:

/                                       — marketing landing. PUBLIC. No uploader.
                                          Shows what the product does, a sample report
                                          screenshot, pricing, and a "Get started" CTA.
/scan                                   — auth required. The uploader. One job: get a PDF.
/resumes                                — auth required. The user's resume library.
/resumes/[resumeId]                     — one resume: score, checks, findings, rewrites,
                                          its list of matches, and a "Match to a job" CTA.
/resumes/[resumeId]/match               — paste a JD. Shows the price (2 credits) clearly.
/resumes/[resumeId]/matches/[matchId]   — one match result. Permanent, revisitable URL.
/pricing                                — credit packs.
/settings                               — account, credit history (read from credit_ledger),
                                          delete my data.

RULES:
- Use React Server Components for all data loading. No useEffect fetch waterfalls.
- Auth guard in the layout for the protected segments, not in each page.
- Every result has a real URL. The user must be able to bookmark, share, and hit Back.
- Delete the old `/profile` route; redirect it to `/resumes`.
- Delete the "job description at upload time" box from the uploader. The JD now lives on
  the /match page, where the 2-credit price is visible before the user commits.

EXCEPTION (keep the shortcut, but honestly): on /scan, an optional collapsed section
"Also match to a job right away" with a checkbox. If checked, show the JD textarea and
update the visible price to "3 credits total". Under the hood this creates a scan row AND
a match row — two records, two ledger entries. The UI is a convenience; the data model
stays clean.
```

**Done when:** you can navigate the whole product with the browser back button and every result page survives a refresh.

---

### Step 3.2 — The resume library (fix the dashboard)

**Prompt for Claude Code:**

```
Rebuild `/resumes` (was /profile).

PROBLEMS WITH THE CURRENT ONE (see the screenshot in ARCHITECTURE.md context):
- Four rows all named "Resume.pdf" with different scores — unusable.
- One row shows a raw UUID as a filename — a bug where file_name wasn't captured.
- Tabs "All / Not matched / Matched" — nobody thinks in these categories.

NEW DESIGN:
- Delete the three filter tabs. Replace with: sort (recent / highest score) and a search
  box that only appears once the user has more than 8 resumes.
- One card per RESUME (not per scan). Each card shows:
    - display_name (editable inline — pencil icon; falls back to file_name)
    - the original filename in small muted text underneath
    - the score as a colored ring/badge with its band label ("74 · Good")
    - the single highest-severity unresolved issue, as one line of text
    - "3 job matches" if it has any, expandable inline to show them:
        "Senior Frontend Engineer — 61%"  ->  links to the match page
    - last activity date
- Add a per-resume overflow menu: Rename, Download PDF, Delete (with confirm).
  Delete must purge the storage object AND cascade the rows. This is a GDPR requirement,
  not a nice-to-have.
- Empty state: a real one. Illustration + "You haven't scanned a resume yet" + the CTA.
- If the user has 0 credits, the "New scan" button must still be visible but show
  "Out of credits — get more" and link to /pricing. Never hide the primary action.

Add `PATCH /api/resumes/[id]` for rename, and `DELETE /api/resumes/[id]` for delete.
```

**Done when:** your own account's list is legible at a glance and you can tell the four `Resume.pdf` rows apart.

---

## Phase 4 — Production hardening

### Step 4.1 — Real rate limiting

Your in-memory limiter does nothing on Vercel. Every serverless instance gets its own `Map`, so your effective limit is `instances × limit`. It is security theater.

**Prompt for Claude Code:**

```
Replace `src/lib/rate-limit.ts` with a Redis-backed limiter using @upstash/ratelimit and
@upstash/redis.

Limits, keyed by user_id (NOT IP — IP is wrong behind Vercel's edge network):
- POST /api/scans          : 10 per hour, 30 per day
- POST /api/.../matches    : 20 per hour, 60 per day
- All other authed routes  : 60 per minute

Add a separate IP-based limiter on the auth callback only, to slow signup abuse.

On limit hit: 429 with a Retry-After header and a friendly message that names the actual
window ("You've hit the hourly limit. Try again in 23 minutes.").

Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.example and to the
env var table in ARCHITECTURE.md.
```

---

### Step 4.2 — Privacy, deletion, and honest copy

**This is the step that keeps you out of legal trouble.** You are storing CVs — real names, phone numbers, home locations. Your homepage currently claims the data is *"not stored"*, which is false, and *"100% Free"*, which is also false.

**Prompt for Claude Code:**

```
Three tasks:

1. COPY FIXES — remove every false claim from the marketing surface:
   - Delete the footer line "Your resume data is processed securely and not stored."
     Replace with: "Your resume is stored privately in your account. You can delete it
     at any time." and link to /privacy.
   - Delete the "100% Free" stat block. Replace with something true, e.g. "10 free credits".
   - Delete the "3+ New Features / Coming Soon" banner. It's placeholder noise.
   - Delete the "100+ ATS Systems" stat unless we can actually substantiate it. Do not
     ship a number we made up.
   - Remove "Our AI analyzes 50+ ATS systems" from the loading screen — same reason.

2. DELETION — implement real data deletion:
   - DELETE /api/resumes/[id] : removes the storage object + cascades resumes/scans/matches.
   - DELETE /api/account      : removes ALL storage objects for the user, all their rows,
     and the auth user. Requires typing their email to confirm. Irreversible.
   - Add both to /settings.

3. Create `/privacy` and `/terms` pages. Plain, honest, human language. State:
   what we collect (the PDF, its extracted text, your email), why (to run the analysis),
   who we share it with (Google Gemini processes the text; nothing else), how long we keep
   it (until you delete it), and how to delete it (settings, one click).
```

---

### Step 4.3 — Honest progress, real states

The "Processing… 23%" bar in your screenshot is fake. Fake progress that stalls at 90% is worse than no progress bar. You now have real stages — show them.

**Prompt for Claude Code:**

```
Replace the fake percentage progress bar with real stage feedback.

The scan pipeline has genuine stages. Stream them to the client (Server-Sent Events or a
simple polling status endpoint — pick the simpler one and tell me which):

  1. "Reading your PDF"          (extraction)
  2. "Checking ATS readability"  (deterministic checks — instant)
  3. "Analyzing your content"    (Gemini — this is the slow one, ~10-30s)
  4. "Scoring"                   (instant)

Show a checkmark as each completes. No percentage. No fabricated 23%.
Remove the fake "Pro Tip" carousel.

Also build the states we are currently missing entirely:
- Zero credits (before upload): disabled uploader + "Get credits" CTA.
- Upload failed (bad file type / too big): inline error on the dropzone, not a toast.
- AI failed / timed out: "Something went wrong. You were not charged." + Retry button.
- Scanned PDF with no text layer: this is a RESULT, not an error. Show a score of 0, a
  big clear explanation, and the fix ("Export from Word/Docs as PDF, don't scan or
  screenshot"). This is one of our most valuable findings — treat it like a finding.
```

---

## Phase 5 — The earning layer

Only start this once Phases 0–4 are green.

### Step 5.1 — Stripe

**Prompt for Claude Code:**

```
Implement Stripe one-time payments for credit packs.

Products:
  Starter    $5   -> 20 credits
  Job hunt   $12  -> 60 credits
  Pro        $9/mo -> 100 credits/month (recurring)

DO NOT ship an uncapped "lifetime unlimited" tier. Unlimited AI calls for a one-time $39
is an unbounded liability against a metered upstream cost. If we keep a lifetime tier at
all, it must be capped (e.g. "50 credits/month, forever").

Requirements:
- Stripe Checkout (hosted). Do not build a card form. We never touch card data.
- Webhook at POST /api/webhooks/stripe:
    - Verify the signature. Reject unsigned requests.
    - IDEMPOTENCY IS MANDATORY: store stripe_event_id with a UNIQUE constraint and no-op
      on replay. Stripe WILL deliver the same event twice. If you don't handle this, users
      get double credits.
    - On checkout.session.completed: grant_credits() + insert the payments row, in ONE
      transaction.
- Credits are granted by the WEBHOOK, never by the success-redirect page. The redirect can
  be closed, refreshed, or forged.
- /settings shows credit history straight from credit_ledger. Every +1 and -1 is visible
  to the user with its reason. This is what the ledger was for.
```

---

## The order, one more time

If you only remember one thing: **1.1 → 1.2 → 1.3 → 1.4 is the whole product.** Text extraction, deterministic checks, a code-computed score, and a Gemini prompt that stops making things up. Everything before it is plumbing and everything after it is polish.

The single most important line in this entire document:

> The same resume must always get the same score.

Your screenshot shows it doesn't. Fix that first, and you have a product people can trust. Ship it with random numbers, and no amount of good UI will save it.

---

## Later — ideas worth building, ranked by value ÷ effort

1. **Compare two scans** of the same resume — "did my edits help?" You already store every scan. This is nearly free and it's your retention loop.
2. **JD from URL** — paste a LinkedIn/Indeed link instead of copying text. Removes the most annoying step in your funnel.
3. **Cover letter from a match** — you already have the parsed resume + parsed JD. One more prompt. This is your highest-value paid feature (charge 3–5 credits).
4. **"Apply all fixes" → export a corrected .docx.** The real endgame. Stop *telling* people their resume is broken and *fix it for them*. That's a 10× product, and it's where the money is.
5. **Chrome extension** — match against whatever job page you're viewing. This is a distribution channel, not just a feature.
