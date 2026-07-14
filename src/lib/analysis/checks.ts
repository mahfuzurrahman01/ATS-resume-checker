import type { PdfExtraction } from "../pdf/extract";

/**
 * Deterministic ATS checks. Pure and side-effect free — NO AI calls. The same
 * PdfExtraction always yields the same CheckResult[]. These are the objective,
 * mechanical facts about a resume that a machine can verify without judgment.
 */

export type CheckCategory =
  | "parseability"
  | "structure"
  | "contact"
  | "content"
  | "formatting";

export type CheckSeverity = "critical" | "high" | "medium" | "low";

export interface CheckResult {
  /** Stable slug, e.g. 'no-text-layer'. */
  id: string;
  category: CheckCategory;
  severity: CheckSeverity;
  /** True when the resume PASSES this check (no problem found). */
  passed: boolean;
  title: string;
  detail: string;
  fix: string;
  /** The offending snippet, when relevant. */
  evidence?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers (all pure)
// ---------------------------------------------------------------------------

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const LINKEDIN_RE = /linkedin\.com\/in\//i;
const BULLET_MARKER = /^[•▪◦‣·o*–—-]\s+/i;

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_RANGE_RE = new RegExp(
  `\\b(?:${MONTH}\\s+)?\\d{4}\\s*(?:-|\\u2013|\\u2014|to)\\s*(?:(?:${MONTH}\\s+)?\\d{4}|present|current|now|ongoing)\\b`,
  "gi"
);

const WEAK_OPENERS = [
  "responsible for",
  "worked on",
  "helped with",
  "assisted",
  "involved in",
  "duties included",
];

const CREATIVE_HEADINGS_RE =
  /\b(my journey|what i bring|about me|who i am|my story|the story so far|let'?s talk|my toolbox)\b/i;

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function findEmail(text: string): string | null {
  return text.match(EMAIL_RE)?.[0] ?? null;
}

function findPhone(text: string): string | null {
  const candidates = text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return c.trim();
  }
  return null;
}

function isHeadingLine(line: string): boolean {
  if (line.length > 40) return false;
  const words = line.split(/\s+/);
  if (words.length > 5) return false;
  return line === line.toUpperCase() || line.endsWith(":");
}

/** Bullet/accomplishment lines. Prefers marker bullets, falls back to prose. */
function getBullets(text: string): string[] {
  const all = lines(text);
  const marked = all
    .filter((l) => BULLET_MARKER.test(l))
    .map((l) => l.replace(BULLET_MARKER, "").trim());
  if (marked.length >= 3) return marked;

  return all
    .filter((l) => {
      if (BULLET_MARKER.test(l)) return true;
      if (l.split(/\s+/).length < 6) return false;
      if (l.endsWith(":") || isHeadingLine(l)) return false;
      return /^[A-Z(]/.test(l);
    })
    .map((l) => l.replace(BULLET_MARKER, "").trim());
}

/** True if any non-trivial line appears on 2+ pages (a real header/footer). */
function hasRepeatedAcrossPages(pages: string[]): boolean {
  if (pages.length < 2) return false;
  const pagesOf = new Map<string, Set<number>>();
  pages.forEach((page, i) => {
    for (const line of new Set(
      page
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length >= 5)
    )) {
      const set = pagesOf.get(line) ?? new Set<number>();
      set.add(i);
      pagesOf.set(line, set);
    }
  });
  for (const set of pagesOf.values()) if (set.size >= 2) return true;
  return false;
}

/** True if every occurrence of any needle sits in the first/last 5% of text. */
function onlyInEdges(text: string, needles: string[]): boolean {
  if (text.length === 0 || needles.length === 0) return false;
  const edge = Math.max(50, Math.floor(text.length * 0.05));
  const positions: number[] = [];
  for (const needle of needles) {
    let idx = text.indexOf(needle);
    while (idx >= 0) {
      positions.push(idx);
      idx = text.indexOf(needle, idx + 1);
    }
  }
  if (positions.length === 0) return false;
  return positions.every((p) => p < edge || p > text.length - edge);
}

// ---------------------------------------------------------------------------
// Parseability
// ---------------------------------------------------------------------------

function noTextLayer(e: PdfExtraction): CheckResult {
  return {
    id: "no-text-layer",
    category: "parseability",
    severity: "critical",
    passed: e.hasTextLayer,
    title: "Resume has no readable text layer",
    detail:
      "We could not extract any text — this looks like a scanned image or screenshot.",
    fix: "Export your resume from Word or Google Docs directly as a PDF. Never scan or screenshot it.",
  };
}

function tooFewWords(e: PdfExtraction): CheckResult {
  return {
    id: "too-few-words",
    category: "parseability",
    severity: "high",
    passed: e.wordCount >= 150,
    title: "Resume is very short",
    detail: `Only ${e.wordCount} words were found; strong resumes usually have more substance.`,
    fix: "Add detail to your experience: what you did, the tools you used, and the outcome.",
  };
}

function tooManyWords(e: PdfExtraction): CheckResult {
  return {
    id: "too-many-words",
    category: "parseability",
    severity: "medium",
    passed: e.wordCount <= 1200,
    title: "Resume is very long",
    detail: `${e.wordCount} words is a lot — recruiters skim, and long resumes bury your best points.`,
    fix: "Trim to your most relevant experience. Aim for one to two pages.",
  };
}

function excessivePages(e: PdfExtraction): CheckResult {
  return {
    id: "excessive-pages",
    category: "parseability",
    severity: "medium",
    passed: e.pageCount <= 2,
    title: "Resume is more than two pages",
    detail: `Found ${e.pageCount} pages. Most roles expect one to two.`,
    fix: "Condense to the two most impactful pages unless you are in academia.",
  };
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

function missingEmail(e: PdfExtraction): CheckResult {
  const email = findEmail(e.text);
  return {
    id: "missing-email",
    category: "contact",
    severity: "critical",
    passed: email !== null,
    title: "No email address found",
    detail: "We could not find an email address in the resume text.",
    fix: "Add a professional email near the top, e.g. firstname.lastname@email.com.",
    evidence: email ?? undefined,
  };
}

function missingPhone(e: PdfExtraction): CheckResult {
  const phone = findPhone(e.text);
  return {
    id: "missing-phone",
    category: "contact",
    severity: "high",
    passed: phone !== null,
    title: "No phone number found",
    detail: "We could not find a phone number in the resume text.",
    fix: "Add a reachable phone number to your contact header.",
    evidence: phone ?? undefined,
  };
}

function missingLinkedin(e: PdfExtraction): CheckResult {
  return {
    id: "missing-linkedin",
    category: "contact",
    severity: "medium",
    passed: LINKEDIN_RE.test(e.text),
    title: "No LinkedIn profile found",
    detail: "No linkedin.com/in/ URL was found.",
    fix: "Add your LinkedIn URL — many recruiters expect it.",
  };
}

function contactInHeaderFooter(e: PdfExtraction): CheckResult {
  const email = findEmail(e.text);
  const phone = findPhone(e.text);
  const needles = [email, phone].filter((n): n is string => n !== null);
  const buried =
    needles.length > 0 &&
    onlyInEdges(e.text, needles) &&
    hasRepeatedAcrossPages(e.pages);
  return {
    id: "contact-in-header-footer",
    category: "contact",
    severity: "high",
    passed: !buried,
    title: "Contact details may be in a header/footer",
    detail:
      "Your contact info appears only in a repeated header or footer region, which many ATS drop.",
    fix: "Move your name, email, and phone into the main body of the document.",
  };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS: ReadonlyArray<{
  key: string;
  label: string;
  re: RegExp;
  severity: CheckSeverity;
}> = [
  {
    key: "experience",
    label: "Experience",
    re: /\b(experience|employment|work history|professional experience)\b/i,
    severity: "high",
  },
  {
    key: "education",
    label: "Education",
    re: /\b(education|academic)\b/i,
    severity: "high",
  },
  {
    key: "skills",
    label: "Skills",
    re: /\b(skills|technical skills|technologies|competencies)\b/i,
    severity: "medium",
  },
];

function missingSections(e: PdfExtraction): CheckResult[] {
  return REQUIRED_SECTIONS.map((section) => ({
    id: `missing-section-${section.key}`,
    category: "structure" as const,
    severity: section.severity,
    passed: section.re.test(e.text),
    title: `Missing ${section.label} section`,
    detail: `No recognizable "${section.label}" heading was found.`,
    fix: `Add a clearly labeled "${section.label}" section with a standard heading.`,
  }));
}

function nonstandardHeadings(e: PdfExtraction): CheckResult {
  const match = e.text.match(CREATIVE_HEADINGS_RE);
  return {
    id: "nonstandard-headings",
    category: "structure",
    severity: "medium",
    passed: match === null,
    title: "Creative section headings detected",
    detail:
      "Unconventional headings (like 'My Journey') can confuse ATS that look for standard labels.",
    fix: "Rename creative headings to standard ones: Experience, Education, Skills.",
    evidence: match?.[0],
  };
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function noQuantifiedBullets(e: PdfExtraction): CheckResult {
  const bullets = getBullets(e.text);
  const quantified = bullets.filter((b) => /[\d%]/.test(b)).length;
  const ratio = bullets.length > 0 ? quantified / bullets.length : 1;
  // Not enough bullets to judge -> pass rather than false-positive.
  const passed = bullets.length < 3 || ratio >= 0.2;
  return {
    id: "no-quantified-bullets",
    category: "content",
    severity: "high",
    passed,
    title: "Few bullets show measurable impact",
    detail: `Only ${quantified} of ${bullets.length} bullet points include a number or percentage.`,
    fix: "Quantify results: 'cut load time 40%', 'led a team of 6', 'saved $200k/yr'.",
  };
}

function weakVerbOpeners(e: PdfExtraction): CheckResult {
  const bullets = getBullets(e.text);
  const offenders = bullets.filter((b) => {
    const lower = b.toLowerCase();
    return WEAK_OPENERS.some((w) => lower.startsWith(w));
  });
  return {
    id: "weak-verb-openers",
    category: "content",
    severity: "high",
    passed: offenders.length === 0,
    title: "Bullets start with weak, passive phrases",
    detail:
      "Openers like 'Responsible for' or 'Worked on' describe duties, not achievements.",
    fix: "Start bullets with strong action verbs: Led, Built, Shipped, Cut, Grew.",
    evidence: offenders.slice(0, 3).join(" | ") || undefined,
  };
}

function firstPersonPronouns(e: PdfExtraction): CheckResult {
  const bullets = getBullets(e.text);
  const offenders = bullets.filter(
    (b) => /\bI\b/.test(b) || /\b(my|me)\b/i.test(b)
  );
  return {
    id: "first-person-pronouns",
    category: "content",
    severity: "low",
    passed: offenders.length === 0,
    title: "First-person pronouns in bullets",
    detail: "Resume bullets conventionally omit 'I', 'my', and 'me'.",
    fix: "Drop the pronoun: 'I built X' becomes 'Built X'.",
    evidence: offenders.slice(0, 3).join(" | ") || undefined,
  };
}

function datesUnparseable(e: PdfExtraction): CheckResult {
  const count = (e.text.match(DATE_RANGE_RE) ?? []).length;
  return {
    id: "dates-unparseable",
    category: "content",
    severity: "high",
    passed: count >= 2,
    title: "Employment dates are hard to parse",
    detail: `Found ${count} clear date ranges; ATS need consistent ranges like "Jan 2022 – Mar 2024".`,
    fix: "Use a consistent date format with a start and end for every role.",
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function likelyMultiColumn(e: PdfExtraction): CheckResult {
  const ls = lines(e.text);
  const shortRatio =
    ls.length > 0 ? ls.filter((l) => l.length < 30).length / ls.length : 0;
  // Conservative: only flag when there are many lines and most are short.
  const suspect = ls.length >= 20 && shortRatio > 0.6;
  return {
    id: "likely-multi-column",
    category: "formatting",
    severity: "medium",
    passed: !suspect,
    title: "Layout may use multiple columns",
    detail:
      "The text extracted as many short, fragmented lines — a common sign of a multi-column layout.",
    fix: "Use a single-column layout. Most ATS read columns out of order.",
  };
}

function specialCharsInContact(e: PdfExtraction): CheckResult {
  const block = e.text.slice(0, 500);
  const match = block.match(/[\uE000-\uF8FF\uFFFD\u2600-\u27BF]/);
  return {
    id: "special-chars-in-contact",
    category: "formatting",
    severity: "medium",
    passed: match === null,
    title: "Icon/special characters near your contact info",
    detail:
      "Icon-font glyphs render as gibberish in text-only ATS and can garble your contact details.",
    fix: "Replace icon fonts with plain text labels (Email:, Phone:, LinkedIn:).",
    evidence: match?.[0],
  };
}

function tablesDetected(e: PdfExtraction): CheckResult {
  const hasRuns =
    /(\t| {3,})/.test(e.text) || e.pages.some((p) => /(\t| {3,})/.test(p));
  return {
    id: "tables-detected",
    category: "formatting",
    severity: "medium",
    passed: !hasRuns,
    title: "Table or column layout detected",
    detail: "Columnar spacing was detected; ATS frequently scramble tables.",
    fix: "Replace tables with simple single-column text and standard bullet points.",
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Runs every deterministic ATS check. Order is stable. */
export function runChecks(extraction: PdfExtraction): CheckResult[] {
  return [
    noTextLayer(extraction),
    tooFewWords(extraction),
    tooManyWords(extraction),
    excessivePages(extraction),
    missingEmail(extraction),
    missingPhone(extraction),
    missingLinkedin(extraction),
    contactInHeaderFooter(extraction),
    ...missingSections(extraction),
    nonstandardHeadings(extraction),
    noQuantifiedBullets(extraction),
    weakVerbOpeners(extraction),
    firstPersonPronouns(extraction),
    datesUnparseable(extraction),
    likelyMultiColumn(extraction),
    specialCharsInContact(extraction),
    tablesDetected(extraction),
  ];
}

const SEVERITY_RANK: Record<CheckSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * The single highest-severity FAILED check, or null if everything passed.
 * Ties keep the first match, so this is deterministic for a given
 * CheckResult[] (runChecks always produces checks in the same order).
 */
export function pickTopIssue(checks: CheckResult[]): CheckResult | null {
  let top: CheckResult | null = null;
  for (const check of checks) {
    if (check.passed) continue;
    if (!top || SEVERITY_RANK[check.severity] < SEVERITY_RANK[top.severity]) {
      top = check;
    }
  }
  return top;
}
