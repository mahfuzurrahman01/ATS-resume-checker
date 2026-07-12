import { createHash } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ResumeData } from "@/lib/gemini-service";

/** Free basic scans allowed per user per calendar day (UTC). */
export const FREE_DAILY_SCANS = 3;

/** Re-serve a cached result if the same file was scanned within this window. */
const CACHE_WINDOW_HOURS = 24;

export function hashFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Number of scans the user has run since the start of the current UTC day. */
export async function getTodayScanCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

/** Returns a recent cached result for the same file, or null. */
export async function getCachedScan(
  userId: string,
  fileHash: string
): Promise<ResumeData | null> {
  const supabase = await createClient();
  const since = new Date(
    Date.now() - CACHE_WINDOW_HOURS * 3600 * 1000
  ).toISOString();
  const { data } = await supabase
    .from("scans")
    .select("result")
    .eq("user_id", userId)
    .eq("file_hash", fileHash)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.result as ResumeData) ?? null;
}

export async function recordScan(
  userId: string,
  scan: {
    score?: number;
    fileHash: string;
    result: ResumeData;
    isDetailed: boolean;
    jdProvided: boolean;
  }
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("scans").insert({
    user_id: userId,
    score: scan.score ?? null,
    file_hash: scan.fileHash,
    result: scan.result,
    is_detailed: scan.isDetailed,
    jd_provided: scan.jdProvided,
  });
}

/**
 * Atomically spends one credit if the balance allows. Uses the service-role
 * client because credits have no client-writable RLS policy.
 * Returns true if a credit was deducted.
 */
export async function spendCredit(userId: string): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("credits")
    .select("balance, is_lifetime")
    .eq("user_id", userId)
    .single();

  if (!data) return false;
  if (data.is_lifetime) return true; // unlimited, nothing to deduct
  if (data.balance <= 0) return false;

  const { error } = await svc
    .from("credits")
    .update({ balance: data.balance - 1, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("balance", data.balance); // optimistic guard against races
  return !error;
}
