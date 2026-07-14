/**
 * Deterministic keyword-overlap percentage between a job description and a
 * resume: a simple token intersection, shown alongside (not instead of) the
 * AI's judgment-based match_score. No AI call, no network — pure and testable.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "as",
  "is", "are", "was", "were", "be", "been", "being", "for", "with", "by",
  "this", "that", "these", "those", "it", "its", "we", "you", "your", "our",
  "will", "have", "has", "had", "not", "from", "into", "about", "than",
  "who", "what", "which", "when", "where", "why", "how", "if", "so", "do",
  "does", "did", "can", "may", "must", "should", "would", "could", "up",
  "out", "all", "any", "each", "other", "such", "no", "nor", "only", "own",
  "same", "too", "very", "just", "also", "us", "their", "they", "he", "she",
]);

function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z][a-z0-9+.#-]{1,}/g) ?? [];
  // Strip trailing sentence punctuation (e.g. "postgres." -> "postgres")
  // while preserving meaningful internal/trailing tech symbols like
  // "node.js", "c++", "c#".
  return raw.map((t) => t.replace(/[.,;:!?]+$/, "")).filter(Boolean);
}

function significantTokens(text: string): Set<string> {
  return new Set(
    tokenize(text).filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

/**
 * Percentage (0-100, integer) of the job description's significant tokens
 * that also appear in the resume text.
 */
export function keywordOverlapPercent(
  jdText: string,
  resumeText: string
): number {
  const jdTokens = significantTokens(jdText);
  if (jdTokens.size === 0) return 0;

  const resumeTokens = significantTokens(resumeText);
  let matched = 0;
  for (const token of jdTokens) {
    if (resumeTokens.has(token)) matched++;
  }
  return Math.round((matched / jdTokens.size) * 100);
}
