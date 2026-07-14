import { createServiceClient } from "@/lib/supabase/server";
import type { CheckResult } from "@/lib/analysis/checks";
import type { ScoreBreakdown } from "@/lib/analysis/score";
import type { ScanResult } from "@/lib/ai/scan-prompt";

/**
 * Data access for the `scans` table (migration 0004): one AI analysis of a
 * resume by itself, no job description. All writes go through the service
 * role — there is no user-facing INSERT policy.
 */

export interface ScanStoredResult {
  ai: ScanResult;
  checks: CheckResult[];
}

export interface ScanRow {
  id: string;
  resume_id: string;
  user_id: string;
  score: number;
  subscores: ScoreBreakdown["subscores"];
  result: ScanStoredResult;
  model_version: string;
  prompt_version: string;
  created_at: string;
}

const COLUMNS =
  "id, resume_id, user_id, score, subscores, result, model_version, prompt_version, created_at";

/** The latest scan for a resume, if any. */
export async function getLatestScanForResume(
  resumeId: string
): Promise<ScanRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("scans")
    .select(COLUMNS)
    .eq("resume_id", resumeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestScanForResume failed: ${error.message}`);
  return (data as ScanRow) ?? null;
}

/**
 * A previously computed scan for the exact (resume, prompt_version,
 * model_version) triple. The file did not change and the prompt/model did
 * not change, so the answer must not change — served free, no new AI call.
 */
export async function findCachedScan(
  resumeId: string,
  promptVersion: string,
  modelVersion: string
): Promise<ScanRow | null> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("scans")
    .select(COLUMNS)
    .eq("resume_id", resumeId)
    .eq("prompt_version", promptVersion)
    .eq("model_version", modelVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findCachedScan failed: ${error.message}`);
  return (data as ScanRow) ?? null;
}

export async function createScan(params: {
  id: string;
  resumeId: string;
  userId: string;
  score: number;
  subscores: ScoreBreakdown["subscores"];
  result: ScanStoredResult;
  modelVersion: string;
  promptVersion: string;
}): Promise<ScanRow> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("scans")
    .insert({
      id: params.id,
      resume_id: params.resumeId,
      user_id: params.userId,
      score: params.score,
      subscores: params.subscores,
      result: params.result,
      model_version: params.modelVersion,
      prompt_version: params.promptVersion,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`createScan failed: ${error.message}`);
  return data as ScanRow;
}
