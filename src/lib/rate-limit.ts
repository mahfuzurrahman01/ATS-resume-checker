import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting, keyed by user_id (never IP — IP is meaningless behind
 * Vercel's shared edge network for authed routes).
 *
 * Uses Upstash Redis — a single shared counter every serverless instance
 * reads/writes over HTTP — when UPSTASH_REDIS_REST_URL/TOKEN are configured.
 * Falls back to an in-memory counter otherwise, so local dev and
 * not-yet-configured deployments still work. The fallback is NOT a real
 * limit across multiple instances (each instance keeps its own counter) —
 * configure Upstash before relying on this in production.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry. 0 when allowed. */
  retryAfter: number;
  /** Human-readable message naming the window, e.g. "You've hit the hourly limit. Try again in 23 minutes." */
  message: string;
}

interface WindowSpec {
  label: string; // e.g. "hourly", "daily", "per-minute"
  windowMs: number;
  max: number;
  /** Upstash duration string, e.g. "1 h". */
  duration: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
}

function isUpstashConfigured(): boolean {
  return (
    !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

const upstashLimiters = new Map<string, Ratelimit>();
function getUpstashLimiter(prefix: string, spec: WindowSpec): Ratelimit {
  const key = `${prefix}:${spec.label}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(spec.max, spec.duration),
      prefix: `atschecker:rl:${key}`,
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// ---- in-memory fallback: independent sliding window per (scope, key) ------
const memoryHits = new Map<string, number[]>();
function checkMemoryWindow(
  scope: string,
  identifier: string,
  spec: WindowSpec
): { allowed: boolean; retryAfter: number } {
  const mapKey = `${scope}:${spec.label}:${identifier}`;
  const now = Date.now();
  const windowStart = now - spec.windowMs;
  const timestamps = (memoryHits.get(mapKey) || []).filter((t) => t > windowStart);

  if (timestamps.length >= spec.max) {
    const retryAfter = Math.max(1, Math.ceil((timestamps[0] + spec.windowMs - now) / 1000));
    memoryHits.set(mapKey, timestamps);
    return { allowed: false, retryAfter };
  }

  timestamps.push(now);
  memoryHits.set(mapKey, timestamps);
  if (memoryHits.size > 5_000) {
    for (const [k, v] of memoryHits) {
      if (v.every((t) => t <= windowStart)) memoryHits.delete(k);
    }
  }
  return { allowed: true, retryAfter: 0 };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(seconds / 3600);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Checks every window in `specs` for `identifier` under `scope`. All windows
 * are checked (not short-circuited) so a request only consumes quota it
 * would have consumed anyway; if multiple windows are exceeded, the one with
 * the longest wait is reported — that's the real binding constraint.
 */
async function checkWindows(
  scope: string,
  identifier: string,
  specs: WindowSpec[]
): Promise<RateLimitResult> {
  const upstash = isUpstashConfigured();
  let worst: { label: string; retryAfter: number } | null = null;

  for (const spec of specs) {
    let allowed: boolean;
    let retryAfter: number;

    if (upstash) {
      const limiter = getUpstashLimiter(scope, spec);
      const result = await limiter.limit(identifier);
      allowed = result.success;
      retryAfter = allowed ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    } else {
      const result = checkMemoryWindow(scope, identifier, spec);
      allowed = result.allowed;
      retryAfter = result.retryAfter;
    }

    if (!allowed && (!worst || retryAfter > worst.retryAfter)) {
      worst = { label: spec.label, retryAfter };
    }
  }

  if (worst) {
    return {
      allowed: false,
      retryAfter: worst.retryAfter,
      message: `You've hit the ${worst.label} limit. Try again in ${formatDuration(worst.retryAfter)}.`,
    };
  }
  return { allowed: true, retryAfter: 0, message: "" };
}

// ---- route-specific limits, per the plan --------------------------------

const SCAN_WINDOWS: WindowSpec[] = [
  { label: "hourly", windowMs: 3_600_000, max: 10, duration: "1 h" },
  { label: "daily", windowMs: 86_400_000, max: 30, duration: "1 d" },
];

const MATCH_WINDOWS: WindowSpec[] = [
  { label: "hourly", windowMs: 3_600_000, max: 20, duration: "1 h" },
  { label: "daily", windowMs: 86_400_000, max: 60, duration: "1 d" },
];

const GENERAL_WINDOW: WindowSpec = {
  label: "per-minute",
  windowMs: 60_000,
  max: 60,
  duration: "1 m",
};

const AUTH_CALLBACK_WINDOW: WindowSpec = {
  label: "per-minute",
  windowMs: 60_000,
  max: 10,
  duration: "1 m",
};

/** POST /api/scans — 10/hour and 30/day, keyed by user_id. */
export function checkScanRateLimit(userId: string): Promise<RateLimitResult> {
  return checkWindows("scan", userId, SCAN_WINDOWS);
}

/** POST /api/resumes/[id]/matches — 20/hour and 60/day, keyed by user_id. */
export function checkMatchRateLimit(userId: string): Promise<RateLimitResult> {
  return checkWindows("match", userId, MATCH_WINDOWS);
}

/** All other authed routes — 60/minute, keyed by user_id. */
export function checkGeneralRateLimit(userId: string): Promise<RateLimitResult> {
  return checkWindows("general", userId, [GENERAL_WINDOW]);
}

/** Auth callback only — 10/minute, keyed by IP, to slow signup abuse. */
export function checkAuthCallbackRateLimit(ip: string): Promise<RateLimitResult> {
  return checkWindows("auth-callback", ip, [AUTH_CALLBACK_WINDOW]);
}
