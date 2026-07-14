import { createServiceClient } from "@/lib/supabase/server";
import { pickTopIssue, type CheckResult } from "@/lib/analysis/checks";
import type { ScanStoredResult } from "@/lib/db/scans";

/**
 * Data access for the `resumes` table (migration 0004). A resume is a unique
 * uploaded file: one row per (user_id, file_hash), enforced by a DB UNIQUE
 * constraint. All writes go through the service role — there is no
 * user-facing INSERT policy.
 */

export interface ResumeRow {
  id: string;
  user_id: string;
  file_hash: string;
  file_name: string;
  display_name: string | null;
  storage_path: string;
  page_count: number | null;
  has_text_layer: boolean;
  created_at: string;
}

const COLUMNS =
  "id, user_id, file_hash, file_name, display_name, storage_path, page_count, has_text_layer, created_at";

export async function findResumeByHash(
  userId: string,
  fileHash: string
): Promise<ResumeRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("resumes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (error) throw new Error(`findResumeByHash failed: ${error.message}`);
  return (data as ResumeRow) ?? null;
}

/**
 * Fetches a resume, scoped to its owner. Returns null both when the resume
 * does not exist and when it belongs to another user — callers should map
 * both cases to 404, never 403, so resume existence is never leaked.
 */
export async function getResumeById(
  userId: string,
  resumeId: string
): Promise<ResumeRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("resumes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("id", resumeId)
    .maybeSingle();
  if (error) throw new Error(`getResumeById failed: ${error.message}`);
  return (data as ResumeRow) ?? null;
}

export interface ResumeMatchSummary {
  id: string;
  jobTitle: string | null;
  matchScore: number;
  createdAt: string;
}

export interface ResumeCard extends ResumeRow {
  /** Score of the most recent scan for this resume, or null if never scanned. */
  latestScore: number | null;
  /** The single highest-severity unresolved issue from the latest scan. */
  topIssue: CheckResult | null;
  /** This resume's matches, newest first. */
  matches: ResumeMatchSummary[];
  /** Most recent of: upload, latest scan, latest match. */
  lastActivityAt: string;
}

/**
 * Lists a user's resumes newest-first, each annotated with its latest scan
 * score/top issue and its matches. Uses two batch queries (not N+1)
 * regardless of how many resumes the user has.
 */
export async function listResumesForUser(userId: string): Promise<ResumeCard[]> {
  const svc = createServiceClient();
  const { data: resumes, error } = await svc
    .from("resumes")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listResumesForUser failed: ${error.message}`);

  const rows = (resumes as ResumeRow[]) ?? [];
  if (rows.length === 0) return [];

  const resumeIds = rows.map((r) => r.id);
  const [scansResult, matchesResult] = await Promise.all([
    svc
      .from("scans")
      .select("resume_id, score, result, created_at")
      .in("resume_id", resumeIds),
    svc
      .from("matches")
      .select("id, resume_id, job_title, match_score, created_at")
      .in("resume_id", resumeIds),
  ]);
  if (scansResult.error) {
    throw new Error(`listResumesForUser (scans) failed: ${scansResult.error.message}`);
  }
  if (matchesResult.error) {
    throw new Error(
      `listResumesForUser (matches) failed: ${matchesResult.error.message}`
    );
  }

  const latestScanByResume = new Map<
    string,
    { score: number; checks: CheckResult[]; createdAt: string }
  >();
  for (const s of scansResult.data ?? []) {
    const existing = latestScanByResume.get(s.resume_id);
    if (!existing || s.created_at > existing.createdAt) {
      // Legacy rows backfilled from the pre-rebuild system carry the old AI
      // response shape, which has no `.checks` array at all — guard so a
      // legacy resume never crashes the list.
      const result = s.result as Partial<ScanStoredResult> | null;
      const checks = Array.isArray(result?.checks) ? result.checks : [];
      latestScanByResume.set(s.resume_id, {
        score: s.score,
        checks,
        createdAt: s.created_at,
      });
    }
  }

  const matchesByResume = new Map<string, ResumeMatchSummary[]>();
  for (const m of matchesResult.data ?? []) {
    const list = matchesByResume.get(m.resume_id) ?? [];
    list.push({
      id: m.id,
      jobTitle: m.job_title,
      matchScore: m.match_score,
      createdAt: m.created_at,
    });
    matchesByResume.set(m.resume_id, list);
  }
  for (const list of matchesByResume.values()) {
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  return rows.map((r) => {
    const scan = latestScanByResume.get(r.id);
    const matches = matchesByResume.get(r.id) ?? [];
    const activityDates = [r.created_at, scan?.createdAt, ...matches.map((m) => m.createdAt)].filter(
      (d): d is string => !!d
    );
    const lastActivityAt = activityDates.reduce(
      (max, d) => (d > max ? d : max),
      r.created_at
    );

    return {
      ...r,
      latestScore: scan?.score ?? null,
      topIssue: scan ? pickTopIssue(scan.checks) : null,
      matches,
      lastActivityAt,
    };
  });
}

/**
 * Renames a resume's display name. Returns null if the resume does not
 * exist or is not owned by the user (callers should map that to 404).
 */
export async function renameResume(
  userId: string,
  resumeId: string,
  displayName: string
): Promise<ResumeRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("resumes")
    .update({ display_name: displayName })
    .eq("user_id", userId)
    .eq("id", resumeId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`renameResume failed: ${error.message}`);
  return (data as ResumeRow) ?? null;
}

/**
 * Deletes the resume row (scans and matches cascade via FK). Does NOT touch
 * storage — callers must delete the storage object separately. Returns true
 * if a row was actually deleted (false = not found / not owned).
 */
export async function deleteResumeRow(
  userId: string,
  resumeId: string
): Promise<boolean> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("resumes")
    .delete()
    .eq("user_id", userId)
    .eq("id", resumeId)
    .select("id");
  if (error) throw new Error(`deleteResumeRow failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function createResume(params: {
  userId: string;
  fileHash: string;
  fileName: string;
  storagePath: string;
  pageCount: number;
  hasTextLayer: boolean;
}): Promise<ResumeRow> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("resumes")
    .insert({
      user_id: params.userId,
      file_hash: params.fileHash,
      file_name: params.fileName,
      storage_path: params.storagePath,
      page_count: params.pageCount,
      has_text_layer: params.hasTextLayer,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`createResume failed: ${error.message}`);
  return data as ResumeRow;
}
