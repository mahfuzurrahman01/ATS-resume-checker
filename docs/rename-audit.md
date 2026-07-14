# Step 0.1 Audit — SCAN + MATCH refactor (resume as a first-class object)

Audit only. No code changed. Awaiting approval before edits.
This supersedes the first-pass rename audit: per approved answers, this is a
data-model refactor, not a find/replace.

---

## 1. Approved model

| Concept | Meaning | Credits (const only this step) |
|---|---|---|
| **SCAN** | A resume analyzed by itself. No JD. | `CREDIT_COST.scan = 1` |
| **MATCH** | A resume analyzed against a specific job description. | `CREDIT_COST.match = 2` |

**Content split**

| Field | Belongs to | Notes |
|---|---|---|
| `ats_analysis` (score, issues, recommendations, keywords) | SCAN | from AI |
| `sections` (experience/education/skills/certs) | SCAN | from AI |
| `pro_suggestions` | SCAN | from AI (resume-only advice) |
| `bullet_rewrites` | **SCAN** | moves out of "detailed" into scan (from AI) |
| `parse_preview` | **REMOVED from AI schema** | becomes a deterministic artifact from our own PDF→text extraction (Phase 1.1). Delete from `ResumeData` and the prompt. |
| `jd_match` (job_title, match_score, matched/missing keywords, title_alignment, summary) | **MATCH** | from AI, only when a JD is present |
| `jd_invalid` / `jd_invalid_message` | **MATCH** | JD validation guard |

**AI input change (Phase 1.1):** the AI is switched from receiving a raw
multi-MB PDF blob to receiving ~3KB of plain extracted text. `parse_preview` is
no longer asked of the model — we already have the extracted text, so we show it
directly. **Net quota impact is negative (good).**

---

## 2. Data model — the real fix

Today a "resume" is not a first-class object; it is re-derived in memory by
grouping `scans` on `file_hash` (`getUserResumes`). That is the root cause of the
library bugs: four rows all named `Resume.pdf`, one row showing a raw UUID as its
name, no dedupe, and no rename.

**New tables (replace the single `scans` table):**

- **`resumes`** — one row per unique uploaded resume.
  - `id` (uuid, pk), `user_id`, `file_hash`, `file_name`, `storage_path`,
    `display_name` (user-renamable), `created_at`.
  - **`UNIQUE (user_id, file_hash)`** — dedupe enforced by the DB, not by code.
- **`scans`** — a resume analyzed alone.
  - `id`, `resume_id` (fk → resumes), `user_id`, `score`, `result` (jsonb, SCAN
    fields only), `created_at`.
- **`matches`** — a resume analyzed against a JD.
  - `id`, `resume_id` (fk → resumes), `user_id`, `job_title`, `match_score`,
    `result` (jsonb, includes `jd_match`), `job_description` (optional, for
    relabel/history), `created_at`.
- **`credit_ledger`** — append-only, auditable.
  - `id`, `user_id`, `delta` (+/-), `reason` (`signup|topup|scan|match|refund|purchase`),
    `ref_id` (nullable → scan/match id), `balance_after`, `created_at`.
  - Balance becomes `sum(delta)` (or a cached column reconciled against the
    ledger). Charging logic itself is a SEPARATE task (answer #4).

**`is_detailed` and `jd_provided` disappear entirely** — the table is the type.
A scan lives in `scans`, a match lives in `matches`; no boolean discriminator.

**Migration phasing (safe, reversible):**
- **`0004_scan_match_split.sql`** — create `resumes`, `scans` (new shape),
  `matches`, `credit_ledger`; rename the existing table to `scans_legacy_v1`;
  backfill: one `resumes` row per distinct `(user_id, file_hash)`, then map each
  legacy row into `scans` (jd not provided) or `matches` (jd provided). Verify
  before destroying anything.
- **`0005_drop_legacy.sql`** — drop `scans_legacy_v1` after backfill is verified.

**Bugs this fixes:** dedupe (UNIQUE constraint), rename (`display_name`),
UUID-as-name (real `resumes` rows have `file_name`/`display_name`, never fall
back to an id), and the duplicate `Resume.pdf` rows (grouping is gone).

---

## 3. Constant — this step only

Define exactly:

```ts
export const CREDIT_COST = { scan: 1, match: 2 } as const;
```

Nothing may hardcode `1`. The **charging logic does not land in this step** — it
arrives with the match pipeline (answer #4). This step just renames the constant
keys (`basic→scan`, `detailed→match`) and sets the values.

---

## 4. Timeouts (ceilings only; expected to trend down)

- `SCAN_TIMEOUT_MS = 90_000`
- `MATCH_TIMEOUT_MS = 120_000`

Rationale: safety ceilings. Because the AI now gets ~3KB of text instead of a PDF
blob, real latency should drop, not rise.

---

## 5. Routes

- **New:** `POST /api/resumes/[resumeId]/matches` — a match belongs to a resume
  (a resume has many matches). Body carries the JD.
- **Removed:** `POST /api/scans/[id]/detailed` (re-encodes the confusion).
- `POST /api/process-resume` → conceptually a **scan create** (and optionally a
  first match). Keep endpoint for now; it should create/lookup a `resumes` row,
  then a `scans` row (and a `matches` row if a JD was supplied). Exact endpoint
  naming (e.g. `POST /api/resumes`) is a Phase-1 decision, flagged below.
- `GET /api/scans/[id]/file` → becomes resume-scoped:
  `GET /api/resumes/[resumeId]/file` (the PDF belongs to the resume, not a scan).

---

## 6. `DetailedReport` is DISSOLVED (not renamed)

If a component named `DetailedReport` exists at the end, the refactor failed.
Its internal subcomponents map as follows:

| Current piece (DetailedReport.tsx) | Destination |
|---|---|
| `ParsePreview` (L238) | **Scan results UI.** No longer AI-sourced — renders the deterministic extracted text (Phase 1.1). |
| `BulletRewrites` (L259) | **Scan results UI** (SCAN content). |
| `JdMatch` (L167) | **Match page** (MATCH content). |
| Unlock/JD CTA + `hasDetailed` gate (L53–121) | **Match flow** (start-a-match UI); the "unlock/purchase" framing is dropped in favor of "run a match". |
| `Feature`, `ChipList`, `scoreColor` helpers | Move with their consumer or inline; delete if unused. |

Consumers to update: `page.tsx:7,415`, `ProfileClient.tsx:30,477`.

---

## 7. Occurrence tables (updated recommendations)

Legend: **SCAN** / **MATCH** / **DELETE** / **SPLIT** / **DB** (schema move) /
**COPY** (marketing).

### src/lib/gemini-service.ts
| Line | Snippet | Rec |
|---|---|---|
| 3, 23–26, 56 | `buildDetailedPrompt`, "DETAILED REPORT MODE" | **SPLIT** → a SCAN prompt (always: ats/sections/pro_suggestions/bullet_rewrites) and a MATCH addendum (jd_match). Input becomes extracted text, not PDF. |
| 58 | `"parse_preview"` prompt instruction | **DELETE** from prompt (deterministic now). |
| 62 | `"bullet_rewrites"` prompt instruction | **SCAN** (keep, move into scan prompt). |
| 39–53 | jd_invalid / jd_match prompt block | **MATCH**. |
| 117, 268, 361, 402, 427 | `pro_suggestions` | **SCAN** (keep). |
| 130 | comment "detailed-report fields (paid)" | **SPLIT/relabel** (scan vs match fields). |
| 132–133 | `jd_invalid` / `jd_invalid_message` type | **MATCH**. |
| 135–142 | `jd_match` type | **MATCH**. |
| 144 | `parse_preview?: string` | **DELETE** from `ResumeData` (not AI). |
| 146–150 | `bullet_rewrites` type | **SCAN**. |
| 153, 157 | `AnalysisMode = "basic" \| "detailed"` | Rename → `"scan" \| "match"`. |
| 194–195, 367 | `detailedSection` branch + injection | **SPLIT** (scan always; match adds jd). |
| 6, 387 | `DETAILED_TIMEOUT_MS` | Rename → `MATCH_TIMEOUT_MS`; add `SCAN_TIMEOUT_MS=90s`, match=120s. |

### src/app/api/process-resume/route.ts
| Line | Snippet | Rec |
|---|---|---|
| 20 | comment | Rewrite. |
| 83–84 | `mode "basic"\|"detailed"` | Rename `scan/match`. |
| 118, 120 | cost comment + `CREDIT_COST.detailed/basic` | Use `.scan/.match`; charging logic deferred (answer #4). |
| 145 | error text "detailed report"/"scan" | MATCH/SCAN wording. |
| 176, 183 | `jd_invalid` handling | **MATCH** path. |
| 201–206 | `recordScan({ isDetailed, jdProvided, … })` | **DB** — replace with insert into `resumes` (upsert) + `scans` (and `matches` if JD). Booleans removed. |

### src/app/api/scans/[id]/detailed/route.ts
| Line | Rec |
|---|---|
| entire file | **DELETE / REPLACE** with `POST /api/resumes/[resumeId]/matches`. Uses new `matches` table; no `isDetailed`/`jdProvided`. |

### src/app/page.tsx
| Line | Snippet | Rec |
|---|---|---|
| 7, 415, 418 | `DetailedReport` usage | Dissolve (see §6). |
| 112, 165, 173 | `mode "detailed"` | `"match"` / `"scan"`. |
| 171 | `handleGetDetailed` | Rename → `handleGetMatch` (points at new matches route). |
| 407–408 | `ProSuggestions` | **SCAN** UI (keep; it's scan content). |
| 410, 413 | comments | Update. |

### src/components/DetailedReport.tsx
| Line | Rec |
|---|---|
| whole file | **DISSOLVE** per §6. Delete file once pieces are relocated. |

### src/components/ProfileClient.tsx
| Line | Snippet | Rec |
|---|---|---|
| 30, 477 | `DetailedReport` | Match page component. |
| 79 | `/api/scans/${id}/detailed` | → `/api/resumes/${resumeId}/matches`. |
| 32, 43, 51–52, 59, 91, 215–216, 397, 416, 439 | `ResumeGroup`, `JobMatch`, `hasJobMatch`, in-memory grouping | **DB** — replace in-memory grouping with real `resumes` + `matches` queries. |
| 137 | `FileActions scanId=…` | Resume-scoped file route. |
| 153, 157–158, 183 | `CREDIT_COST.detailed` labels | `.match`. |

### src/lib/scans.ts  ← largest rewrite
| Line | Snippet | Rec |
|---|---|---|
| 54–61 | `ScanRecord` (has `is_detailed`, `jd_provided`) | **DB** — replace with `Resume` / `Scan` / `Match` types; booleans removed. |
| 113–136 | `recordScan` (writes is_detailed/jd_provided) | **DB** — split into `upsertResume`, `createScan`, `createMatch`. |
| 139–166 | `getUserScans` / `getScanById` (select `is_detailed, jd_provided`) | **DB** — query new tables; drop booleans. |
| 169–232 | `JobMatch`, `ResumeGroup`, `getUserResumes` (in-memory grouping) | **DB** — resumes are now real rows; grouping logic deleted. |
| 210, 214–215 | `.filter(jd_provided && jd_match)` | Replaced by `matches` table rows. |
| 67–68, 79, 129, 134 | storage path / file_name plumbing | Keep, but sourced from `resumes` row. |

### src/lib/generate-pdf-report.ts
| Line | Snippet | Rec |
|---|---|---|
| 225 | comment "detailed report sections" | **SPLIT.** |
| 226–244 | `jd_match` rendering | **MATCH** section (only on a match's PDF). |
| 248–255 | `bullet_rewrites` rendering | **SCAN** section. |
| 258–265 | `parse_preview` rendering | **SCAN** section, but source = deterministic extracted text (not AI field). |

### src/lib/credit-costs.ts
| Line | Rec |
|---|---|
| 8–9 | Rename keys `basic→scan`, `detailed→match`; values `{ scan: 1, match: 2 }`. |

### supabase/migrations/0001_init.sql
| Line | Rec |
|---|---|
| 26, 33, 34 | Do **not** edit. Superseded by new `0004`/`0005`. |

### Marketing copy (out of scope)
`SignInGate.tsx:34`, `about/page.tsx:68`, `contact/page.tsx:224` — generic
"detailed" wording; leave unless we do a copy pass.

---

## 8. New artifacts this refactor requires

- **PDF→text extraction module** (Phase 1.1) — deterministic server-side
  extraction feeding both the AI input and `parse_preview` display.
  → **Needs a new dependency (flagged, not added):** recommend **`unpdf`**
  (modern, serverless/Vercel-friendly, bundles pdf.js, no native binaries).
  Alternatives: `pdf-parse` (simpler, older, less serverless-friendly),
  `pdfjs-dist` (heavier, manual setup). **Please approve the package before
  Phase 1.1.**
- New DB types (`Resume`, `Scan`, `Match`, `LedgerEntry`) + data-access
  functions in `src/lib/` (likely split `scans.ts` into `resumes.ts` / `matches.ts`).
- New route `POST /api/resumes/[resumeId]/matches` and resume-scoped file route.
- Scan results UI gains the parse-preview + bullet-rewrites panels; a match page
  renders jd_match.

---

## 9. Open decisions for Phase 1 (not blocking this audit)

1. **PDF extraction library:** approve `unpdf` (recommended) or pick another.
2. **`credit_ledger` shape:** cached `balance` column reconciled to the ledger,
   or compute `sum(delta)` on read? (affects the credits table.)
3. **Resume rename UX:** where the user renames (`display_name`) — inline in the
   library card, or on the resume page?
4. **`process-resume` endpoint naming:** keep `POST /api/process-resume` as the
   scan-create, or introduce `POST /api/resumes`? (First match at upload creates
   a resume + scan + match.)
5. **Storage path:** keep `${userId}/${fileHash}.pdf` (already dedupes at storage
   level) — confirm.

---

**Stopping here. No code will change until you approve this plan.**
