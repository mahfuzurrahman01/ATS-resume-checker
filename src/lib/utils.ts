import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a safe href for AI-extracted URLs, or undefined if the value is not
 * a valid http(s) URL. Blocks XSS vectors like `javascript:` and `data:` URLs.
 * Adds a missing protocol so bare domains still link correctly.
 */
export function safeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Cheap, LENIENT client-side check to catch obviously-not-a-job-description
 * text before it reaches Gemini (saves quota + credits). Errs toward allowing:
 * only blocks text that is too short, or clearly code/SQL with no hiring words.
 * The server + AI still validate as the real safety net.
 */
export function looksLikeJobDescription(text: string): {
  ok: boolean;
  reason?: string;
} {
  const t = text.trim();
  if (t.length < 40) {
    return {
      ok: false,
      reason:
        "That's too short to be a job description. Paste the full job posting.",
    };
  }

  const lower = t.toLowerCase();

  // Broad set of hiring/JD signals — if ANY appears, allow it through.
  const jobHints = [
    "responsib",
    "require",
    "qualif",
    "experience",
    "skills",
    "hiring",
    "we are looking",
    "looking for",
    "join",
    "role",
    "position",
    "job",
    "apply",
    "candidate",
    "team",
    "salary",
    "benefits",
    "remote",
    "onsite",
    "full-time",
    "full time",
    "part-time",
    "developer",
    "engineer",
    "manager",
    "designer",
    "intern",
    "years of",
    "you will",
    "you'll",
    "opportunit",
    "work with",
    "about the",
    "who you are",
    "what you",
  ];
  if (jobHints.some((h) => lower.includes(h))) return { ok: true };

  // No hiring words found — block only if it clearly looks like code/markup.
  const codeSignals = [
    "create policy",
    "insert into",
    "alter table",
    "select ",
    "from ",
    "function(",
    "=>",
    "const ",
    "import ",
    "public class",
    "def ",
    "</",
    "{",
    "};",
  ];
  const codeCount = codeSignals.filter((s) => lower.includes(s)).length;
  if (codeCount >= 2) {
    return {
      ok: false,
      reason:
        "That doesn't look like a job description. Please paste a real job posting.",
    };
  }

  // Otherwise let it through — the server/AI makes the final call.
  return { ok: true };
}

/** Human-friendly URL for display: strips protocol, `www.`, and trailing slash. */
export function displayUrl(value?: string): string {
  const safe = safeUrl(value);
  if (!safe) return "";
  return safe
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}
