/**
 * Single source of truth for credit costs, safe to import in both client
 * components and server code (no server-only dependencies here).
 */
export const CREDIT_COST = {
  /** @deprecated legacy vocabulary, kept only for pre-Phase-3 UI. Use `scan`. */
  basic: 1,
  /** @deprecated legacy vocabulary, kept only for pre-Phase-3 UI. Use `match`. */
  detailed: 1,
  /** A resume analyzed by itself, no job description. */
  scan: 1,
  /** A resume analyzed against a specific job description. */
  match: 2,
} as const;
