/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * NOTE: state lives in a single process, so on serverless (Vercel) each
 * instance keeps its own counters. It stops casual abuse but is not a hard
 * global limit. For production-grade limiting across instances, back this
 * with Upstash Redis (@upstash/ratelimit) using the same interface.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10; // per IP per window

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
    hits.set(key, timestamps);
    return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  // Opportunistic cleanup to keep the map from growing unbounded.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  return { allowed: true, retryAfter: 0 };
}
