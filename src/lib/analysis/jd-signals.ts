/**
 * Cheap, deterministic local validation of a job description: no AI call, no
 * credit charged if it fails. This is the gate that stops obviously-not-a-JD
 * text from ever reaching Gemini.
 */

export interface JdValidation {
  ok: boolean;
  wordCount: number;
  signalsFound: string[];
}

const MIN_WORDS = 100;
const MIN_SIGNALS = 2;

const SIGNALS: ReadonlyArray<{ id: string; re: RegExp }> = [
  {
    id: "requirements-heading",
    re: /\b(requirements|responsibilities|qualifications)\s*:?/i,
  },
  { id: "years-of-experience", re: /\byears?\s+of\s+experience\b/i },
  { id: "we-are-looking", re: /\bwe(?:'re| are)\s+looking\b/i },
  { id: "you-will", re: /\byou(?:'ll| will)\b/i },
  {
    id: "seniority-word",
    re: /\b(junior|mid-level|senior|lead|principal|staff|intern|entry-level)\b/i,
  },
];

/**
 * Validates that `text` looks like a job description: at least 100 words and
 * at least 2 of 5 job-posting signals present.
 */
export function validateJobDescription(text: string): JdValidation {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const signalsFound = SIGNALS.filter((s) => s.re.test(text)).map(
    (s) => s.id
  );
  return {
    ok: wordCount >= MIN_WORDS && signalsFound.length >= MIN_SIGNALS,
    wordCount,
    signalsFound,
  };
}
