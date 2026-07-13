/**
 * Single source of truth for credit costs, safe to import in both client
 * components and server code (no server-only dependencies here).
 */
export const CREDIT_COST = {
  /** A general resume scan (score, issues, skills). */
  basic: 1,
  /** A detailed report (job match, parse preview, bullet rewrites). */
  detailed: 1,
} as const;
