import { createServiceClient } from "@/lib/supabase/server";
import type { MatchResult } from "@/lib/ai/match-prompt";

/**
 * Data access for the `matches` table (migration 0004): one AI analysis of a
 * resume against a job description. All writes go through the service role —
 * there is no user-facing INSERT policy.
 */

export interface MatchStoredResult {
  ai: MatchResult;
  keywordOverlapPercent: number;
}

export interface MatchRow {
  id: string;
  resume_id: string;
  user_id: string;
  jd_text: string;
  jd_hash: string;
  job_title: string | null;
  company: string | null;
  match_score: number;
  result: MatchStoredResult;
  model_version: string;
  prompt_version: string;
  created_at: string;
}

const COLUMNS =
  "id, resume_id, user_id, jd_text, jd_hash, job_title, company, match_score, result, model_version, prompt_version, created_at";

/**
 * An existing match for the exact (resume, jd_hash, prompt_version) triple.
 * Same JD + same resume + same prompt = same answer, served free.
 */
export async function findMatchByJdHash(
  resumeId: string,
  jdHash: string,
  promptVersion: string
): Promise<MatchRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("matches")
    .select(COLUMNS)
    .eq("resume_id", resumeId)
    .eq("jd_hash", jdHash)
    .eq("prompt_version", promptVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findMatchByJdHash failed: ${error.message}`);
  return (data as MatchRow) ?? null;
}

/** All matches for a resume, newest first. */
export async function listMatchesForResume(resumeId: string): Promise<MatchRow[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("matches")
    .select(COLUMNS)
    .eq("resume_id", resumeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMatchesForResume failed: ${error.message}`);
  return (data as MatchRow[]) ?? [];
}

/**
 * Fetches a match, scoped to its owner. Returns null both when the match
 * does not exist and when it belongs to another user — callers should map
 * both cases to 404, never 403.
 */
export async function getMatchById(
  userId: string,
  matchId: string
): Promise<MatchRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("matches")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw new Error(`getMatchById failed: ${error.message}`);
  return (data as MatchRow) ?? null;
}

export async function createMatch(params: {
  id: string;
  resumeId: string;
  userId: string;
  jdText: string;
  jdHash: string;
  jobTitle: string | null;
  company: string | null;
  matchScore: number;
  result: MatchStoredResult;
  modelVersion: string;
  promptVersion: string;
}): Promise<MatchRow> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("matches")
    .insert({
      id: params.id,
      resume_id: params.resumeId,
      user_id: params.userId,
      jd_text: params.jdText,
      jd_hash: params.jdHash,
      job_title: params.jobTitle,
      company: params.company,
      match_score: params.matchScore,
      result: params.result,
      model_version: params.modelVersion,
      prompt_version: params.promptVersion,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`createMatch failed: ${error.message}`);
  return data as MatchRow;
}
