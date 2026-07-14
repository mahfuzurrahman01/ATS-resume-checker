import type { CheckCategory, CheckResult, CheckSeverity } from "./checks";

/**
 * Deterministic scoring. The AI never produces the score — it is computed here,
 * in code, from the CheckResult[] produced by ./checks. Same checks in, same
 * score out, every time. The rubric weights are exported so the UI can show the
 * breakdown ("Parseability 24/30"). Transparency is the feature.
 */

/** Points available per category. Sums to 100. */
export const CATEGORY_MAX = {
  parseability: 30,
  structure: 20,
  contact: 15,
  content: 25,
  formatting: 10,
} as const satisfies Record<CheckCategory, number>;

/**
 * Fraction of a category's max deducted per failed check, by severity.
 * `critical` = 1 (the whole category drops to 0).
 */
export const SEVERITY_PENALTY = {
  critical: 1,
  high: 0.4,
  medium: 0.2,
  low: 0.1,
} as const satisfies Record<CheckSeverity, number>;

export type Band = "critical" | "needs-work" | "good" | "excellent";

export interface ScoreBreakdown {
  total: number; // 0-100, integer
  band: Band;
  subscores: {
    parseability: { earned: number; max: 30 };
    structure: { earned: number; max: 20 };
    contact: { earned: number; max: 15 };
    content: { earned: number; max: 25 };
    formatting: { earned: number; max: 10 };
  };
}

const CATEGORIES = [
  "parseability",
  "structure",
  "contact",
  "content",
  "formatting",
] as const satisfies readonly CheckCategory[];

/** Maps a 0-100 total to its band. Exported so the UI can badge a bare score. */
export function bandFor(total: number): Band {
  if (total <= 39) return "critical";
  if (total <= 64) return "needs-work";
  if (total <= 84) return "good";
  return "excellent";
}

/** Points earned in a single category from its failed checks. */
function earnedForCategory(
  checks: CheckResult[],
  category: CheckCategory
): number {
  const max = CATEGORY_MAX[category];
  const penalty = checks
    .filter((c) => c.category === category && !c.passed)
    .reduce((sum, c) => sum + SEVERITY_PENALTY[c.severity], 0);
  return Math.max(0, Math.round(max * (1 - penalty)));
}

/** Computes the transparent 0-100 score breakdown from the checks. */
export function computeScore(checks: CheckResult[]): ScoreBreakdown {
  const earned: Record<CheckCategory, number> = {
    parseability: earnedForCategory(checks, "parseability"),
    structure: earnedForCategory(checks, "structure"),
    contact: earnedForCategory(checks, "contact"),
    content: earnedForCategory(checks, "content"),
    formatting: earnedForCategory(checks, "formatting"),
  };

  // HARD RULE: no readable text layer -> an ATS literally cannot read the file.
  // Score is 0 regardless of anything else, and every category earns nothing.
  const noTextLayer = checks.some(
    (c) => c.id === "no-text-layer" && !c.passed
  );
  const finalEarned: Record<CheckCategory, number> = noTextLayer
    ? {
        parseability: 0,
        structure: 0,
        contact: 0,
        content: 0,
        formatting: 0,
      }
    : earned;

  const total = CATEGORIES.reduce((sum, c) => sum + finalEarned[c], 0);

  return {
    total,
    band: noTextLayer ? "critical" : bandFor(total),
    subscores: {
      parseability: {
        earned: finalEarned.parseability,
        max: CATEGORY_MAX.parseability,
      },
      structure: { earned: finalEarned.structure, max: CATEGORY_MAX.structure },
      contact: { earned: finalEarned.contact, max: CATEGORY_MAX.contact },
      content: { earned: finalEarned.content, max: CATEGORY_MAX.content },
      formatting: {
        earned: finalEarned.formatting,
        max: CATEGORY_MAX.formatting,
      },
    },
  };
}
