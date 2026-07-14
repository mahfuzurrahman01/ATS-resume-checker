import { createHash } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ResumeData } from "@/lib/gemini-service";

export { CREDIT_COST } from "@/lib/credit-costs";

/** Monthly free top-up: bring balance up to this if it falls below it. */
export const MONTHLY_FREE_CREDITS = 3;
const TOPUP_INTERVAL_MS = 30 * 24 * 3600 * 1000; // 30 days

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

const RESUME_BUCKET = "resumes";

export interface ScanRecord {
  id: string;
  created_at: string;
  score: number | null;
  is_detailed: boolean;
  jd_provided: boolean;
  file_name: string | null;
  storage_path: string | null;
  file_hash: string | null;
  result: ResumeData;
}

/** Storage path for a user's resume file. */
function resumePath(userId: string, fileHash: string): string {
  return `${userId}/${fileHash}.pdf`;
}

/** Uploads the PDF to private storage (idempotent by hash). Returns the path. */
export async function uploadResumePdf(
  userId: string,
  fileHash: string,
  buffer: Buffer
): Promise<string | null> {
  try {
    const svc = createServiceClient();
    const path = resumePath(userId, fileHash);
    const { error } = await svc.storage
      .from(RESUME_BUCKET)
      .upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) {
      console.error("Resume upload failed:", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("Resume upload threw:", e);
    return null;
  }
}

/** Downloads a stored resume PDF as a Buffer, or null if missing. */
export async function downloadResumePdf(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.storage
      .from(RESUME_BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

export async function recordScan(
  userId: string,
  scan: {
    score?: number;
    fileHash: string;
    result: ResumeData;
    isDetailed: boolean;
    jdProvided: boolean;
    storagePath?: string | null;
    fileName?: string | null;
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
    storage_path: scan.storagePath ?? null,
    file_name: scan.fileName ?? null,
  });
}

/** All scans for a user, newest first (for the profile/dashboard). */
export async function getUserScans(userId: string): Promise<ScanRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scans")
    .select(
      "id, created_at, score, is_detailed, jd_provided, file_name, storage_path, file_hash, result"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as ScanRecord[]) ?? [];
}

/** A single scan owned by the user, or null. */
export async function getScanById(
  userId: string,
  scanId: string
): Promise<ScanRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scans")
    .select(
      "id, created_at, score, is_detailed, jd_provided, file_name, storage_path, file_hash, result"
    )
    .eq("user_id", userId)
    .eq("id", scanId)
    .maybeSingle();
  return (data as ScanRecord) ?? null;
}

export interface JobMatch {
  scanId: string;
  createdAt: string;
  jobTitle: string;
  matchScore: number | null;
  result: ResumeData;
}

/** A unique uploaded resume with its basic scan + all job matches. */
export interface ResumeGroup {
  fileHash: string;
  fileName: string | null;
  storagePath: string | null;
  representativeScanId: string; // any scan of this file (for the file URL)
  uploadedAt: string; // earliest scan for this file
  score: number | null; // representative ATS score
  result: ResumeData; // representative result (for contact/skills/etc.)
  jobMatches: JobMatch[];
  hasJobMatch: boolean;
}

/**
 * Groups the user's scans into unique resumes (by file hash). Each resume
 * carries a representative basic result plus every job match run on it.
 */
export async function getUserResumes(userId: string): Promise<ResumeGroup[]> {
  const scans = await getUserScans(userId); // newest first
  const groups = new Map<string, ScanRecord[]>();

  for (const scan of scans) {
    const key = scan.file_hash || scan.storage_path || scan.id;
    const list = groups.get(key) ?? [];
    list.push(scan);
    groups.set(key, list);
  }

  const resumes: ResumeGroup[] = [];
  for (const [key, list] of groups) {
    // list is newest-first. Representative = most recent scan for display.
    const rep = list[0];
    const jobMatches: JobMatch[] = list
      .filter((s) => s.jd_provided && s.result?.jd_match)
      .map((s) => ({
        scanId: s.id,
        createdAt: s.created_at,
        jobTitle: s.result.jd_match?.job_title || "Job match",
        matchScore: s.result.jd_match?.match_score ?? null,
        result: s.result,
      }));

    resumes.push({
      fileHash: key,
      fileName: rep.file_name,
      storagePath: rep.storage_path,
      representativeScanId: rep.id,
      uploadedAt: list[list.length - 1].created_at,
      score: rep.score,
      result: rep.result,
      jobMatches,
      hasJobMatch: jobMatches.length > 0,
    });
  }

  // Newest resumes first.
  resumes.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  return resumes;
}

/** Signed, short-lived URL to view or download a stored resume PDF. */
export async function getSignedResumeUrl(
  storagePath: string,
  download?: string | false
): Promise<string | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.storage
      .from("resumes")
      .createSignedUrl(storagePath, 120, download ? { download } : undefined);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Atomically spends `amount` credits if the balance allows. Uses the
 * service-role client (credits have no client-writable RLS policy).
 * Returns true if the credits were deducted.
 */
export async function spendCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("credits")
    .select("balance, is_lifetime")
    .eq("user_id", userId)
    .single();

  if (!data) return false;
  if (data.is_lifetime) return true; // unlimited, nothing to deduct
  if (data.balance < amount) return false;

  const { error } = await svc
    .from("credits")
    .update({
      balance: data.balance - amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("balance", data.balance); // optimistic guard against races
  return !error;
}

/** Refunds `amount` credits — used when analysis fails after spending. */
export async function refundCredits(
  userId: string,
  amount: number
): Promise<void> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("credits")
    .select("balance, is_lifetime")
    .eq("user_id", userId)
    .single();
  if (!data || data.is_lifetime) return; // nothing was deducted for lifetime
  await svc
    .from("credits")
    .update({
      balance: data.balance + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/**
 * Lazy monthly free top-up. If at least 30 days passed since the last top-up
 * and the balance is below MONTHLY_FREE_CREDITS, tops it up. Non-stacking:
 * users who still have unused free credits get nothing new. No-op for lifetime.
 */
export async function ensureMonthlyTopUp(userId: string): Promise<void> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("credits")
    .select("balance, is_lifetime, last_free_topup_at")
    .eq("user_id", userId)
    .single();
  if (!data || data.is_lifetime) return;

  const last = data.last_free_topup_at
    ? new Date(data.last_free_topup_at).getTime()
    : 0;
  const due = Date.now() - last >= TOPUP_INTERVAL_MS;
  if (!due || data.balance >= MONTHLY_FREE_CREDITS) return;

  await svc
    .from("credits")
    .update({
      balance: MONTHLY_FREE_CREDITS,
      last_free_topup_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
