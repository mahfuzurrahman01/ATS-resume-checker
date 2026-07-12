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

/** Human-friendly URL for display: strips protocol, `www.`, and trailing slash. */
export function displayUrl(value?: string): string {
  const safe = safeUrl(value);
  if (!safe) return "";
  return safe
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}
