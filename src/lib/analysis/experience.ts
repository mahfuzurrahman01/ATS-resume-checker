/**
 * Deterministic total-experience calculator. Parses date ranges directly out
 * of the resume text with regex and sums them in code — the AI never
 * computes this. Same reasoning as the score: an LLM doing inline date
 * arithmetic gives a different (and often wrong) answer on every call, even
 * for the exact same resume. This is always exact given the same text and
 * the same day it's run on.
 */

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * Builds a case-insensitive-ish alternation WITHOUT the regex `i` flag: only
 * the first letter is tolerant of either case (covers "Nov"/"nov", the
 * overwhelming common cases on a resume), leaving the rest lowercase-only.
 * This matters because the `i` flag would apply to the ENTIRE regex,
 * including the lookarounds below that specifically rely on `[a-z]` meaning
 * "lowercase only" to distinguish a glued-together word boundary from a
 * genuine mid-word position. `i` would silently turn those into
 * "any letter", defeating the fix.
 */
function firstLetterEitherCase(words: string[]): string {
  return words
    .map((w) => `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`)
    .join("|");
}

const MONTH_NAME = `(${firstLetterEitherCase([
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
])})[a-z]*\\.?`;
const PRESENT_WORD = firstLetterEitherCase([
  "present",
  "current",
  "currently",
  "now",
  "ongoing",
  "today",
]);
const RANGE_SEP = `(?:-|\\u2013|\\u2014|${firstLetterEitherCase(["to"])})`;

// Capture groups: 1=startMonth 2=startYear 3=endMonth 4=endYear 5=presentWord
//
// The leading/trailing boundaries deliberately use lookaround instead of \b:
// PDF text extraction often flattens a two-column resume layout (dates in
// one column, role title in the next) into one line with NO separator, e.g.
// "Dec 2024 - PresentSoftware Developer" or "Jan 2023Frontend Developer".
// A digit or lowercase "t" immediately followed by an uppercase letter is
// NOT a \b boundary (both sides are word characters), so a strict \b silently
// fails to match real extracted text like this. We instead only require that
// what follows/precedes is not a *lowercase* letter — that still rejects
// false positives like matching "present" inside "presently", while
// tolerating the glued-uppercase-word artifact. No `i` flag — see
// firstLetterEitherCase() above for why.
const RANGE_RE = new RegExp(
  `(?<![a-z])(?:${MONTH_NAME}\\s+)?(\\d{4})\\s*${RANGE_SEP}\\s*(?:(?:${MONTH_NAME}\\s+)?(\\d{4})|(${PRESENT_WORD}))(?![a-z])`,
  "g"
);

function monthIndex(name: string | undefined, fallback: number): number {
  if (!name) return fallback;
  return MONTH_INDEX[name.toLowerCase()] ?? fallback;
}

interface Interval {
  start: number; // absolute month index: year * 12 + monthIndex
  end: number; // exclusive
}

export interface ExperienceEstimate {
  totalMonths: number;
  years: number;
  months: number;
  label: string;
}

function formatLabel(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0 || parts.length === 0) {
    parts.push(`${months} month${months === 1 ? "" : "s"}`);
  }
  return parts.join(" ");
}

/**
 * Extracts every date range in `text`, merges overlapping/adjacent ranges
 * (concurrent or back-to-back roles should not double-count), and returns
 * the total. Returns null if no date range could be parsed.
 */
export function computeExperience(
  text: string,
  now: Date = new Date()
): ExperienceEstimate | null {
  const nowAbs = now.getFullYear() * 12 + now.getMonth();
  const intervals: Interval[] = [];

  for (const match of text.matchAll(RANGE_RE)) {
    const [, startMonthName, startYearStr, endMonthName, endYearStr, presentWord] = match;

    // Bare year ranges ("2019 - 2021") are typically education, not
    // employment — real job ranges on a resume almost always name at least
    // one month. Skip anything with no month on either side to avoid
    // sweeping education/graduation years into "years of experience".
    if (!startMonthName && !endMonthName && !presentWord) continue;

    const startYear = parseInt(startYearStr, 10);
    const start = startYear * 12 + monthIndex(startMonthName, 0);

    let end: number;
    if (presentWord) {
      end = nowAbs + 1; // exclusive upper bound includes the current month
    } else if (endYearStr) {
      const endYear = parseInt(endYearStr, 10);
      end = endYear * 12 + monthIndex(endMonthName, 11) + 1;
    } else {
      continue; // malformed match, skip
    }

    if (end > start) intervals.push({ start, end });
  }

  if (intervals.length === 0) return null;

  intervals.sort((a, b) => a.start - b.start);
  let totalMonths = 0;
  let curStart = intervals[0].start;
  let curEnd = intervals[0].end;
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= curEnd) {
      curEnd = Math.max(curEnd, next.end);
    } else {
      totalMonths += curEnd - curStart;
      curStart = next.start;
      curEnd = next.end;
    }
  }
  totalMonths += curEnd - curStart;

  return {
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    label: formatLabel(totalMonths),
  };
}
