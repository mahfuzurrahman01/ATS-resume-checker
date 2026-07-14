import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { checkMatchRateLimit } from "@/lib/rate-limit";
import { sha256Hex } from "@/lib/hash";
import { extractPdf } from "@/lib/pdf/extract";
import { keywordOverlapPercent } from "@/lib/analysis/keyword-overlap";
import { validateJobDescription } from "@/lib/analysis/jd-signals";
import { MODEL_VERSION, generateJson, AiError } from "@/lib/ai/client";
import {
  PROMPT_VERSION,
  MATCH_SYSTEM_PROMPT,
  MATCH_TIMEOUT_MS,
  matchSchema,
  buildMatchUserInput,
} from "@/lib/ai/match-prompt";
import { getResumeById } from "@/lib/db/resumes";
import {
  findMatchByJdHash,
  createMatch,
  type MatchRow,
} from "@/lib/db/matches";
import { downloadResumePdf } from "@/lib/storage/resume-pdf";
import {
  spendCredits,
  grantCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { CREDIT_COST } from "@/lib/credit-costs";
import { ndjsonResponse } from "@/lib/streaming";

interface MatchResultPayload {
  match_id: string;
  resume_id: string;
  job_title: string | null;
  company: string | null;
  match_score: number;
  keyword_overlap_percent: number;
  ai: MatchRow["result"]["ai"];
  credits: { balance: number; isLifetime: boolean };
}

function matchResponse(
  match: MatchRow,
  credits: { balance: number; isLifetime: boolean }
): MatchResultPayload {
  return {
    match_id: match.id,
    resume_id: match.resume_id,
    job_title: match.job_title,
    company: match.company,
    match_score: match.match_score,
    keyword_overlap_percent: match.result.keywordOverlapPercent,
    ai: match.result.ai,
    credits,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  // --- Fast pre-flight checks: plain JSON + real status codes. ----------
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // Verify the user OWNS this resume_id. 404 (not 403) if not — do not
  // leak existence.
  const { resumeId } = await params;
  const resume = await getResumeById(user.id, resumeId);
  if (!resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  const rateLimit = await checkMatchRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const jobDescription =
    typeof body?.jobDescription === "string" ? body.jobDescription : "";

  const jdCheck = validateJobDescription(jobDescription);
  if (!jdCheck.ok) {
    return NextResponse.json(
      { error: "That doesn't look like a job description.", code: "INVALID_JD" },
      { status: 422 }
    );
  }

  // --- From here on: one continuous NDJSON stream. -----------------------
  return ndjsonResponse<MatchResultPayload>(async (stream) => {
    // Same JD + same resume + same prompt = same answer, served free.
    const jdHash = sha256Hex(Buffer.from(jobDescription, "utf-8"));
    const cached = await findMatchByJdHash(resume.id, jdHash, PROMPT_VERSION);
    if (cached) {
      stream.result(matchResponse(cached, await getUserCredits(user.id)));
      return;
    }

    stream.stage("load", "start");
    const pdfBuffer = await downloadResumePdf(resume.storage_path);
    const extraction = await extractPdf(pdfBuffer);
    stream.stage("load", "done");

    stream.stage("ai", "start");
    let ai;
    try {
      ai = await generateJson({
        systemPrompt: MATCH_SYSTEM_PROMPT,
        userText: buildMatchUserInput(extraction.text, jobDescription),
        schema: matchSchema,
        timeoutMs: MATCH_TIMEOUT_MS,
      });
    } catch (error) {
      const message =
        error instanceof AiError
          ? error.userMessage
          : "Something went wrong while matching this resume. Please try again.";
      stream.error(message);
      return;
    }
    stream.stage("ai", "done");

    if (!ai.jd_valid) {
      stream.error(
        ai.rejection_reason || "That doesn't look like a job description.",
        "INVALID_JD"
      );
      return;
    }

    // ONLY NOW charge credits.
    const matchId = randomUUID();
    try {
      await spendCredits(user.id, CREDIT_COST.match, "match", "match", matchId);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        stream.error(
          "You're out of credits. Buy more credits to keep matching.",
          "OUT_OF_CREDITS"
        );
        return;
      }
      throw error;
    }

    // Compute keyword overlap, persist the match. Refund on any failure
    // after the charge above.
    try {
      stream.stage("score", "start");
      const overlap = keywordOverlapPercent(jobDescription, extraction.text);

      const match = await createMatch({
        id: matchId,
        resumeId: resume.id,
        userId: user.id,
        jdText: jobDescription,
        jdHash,
        jobTitle: ai.job.title,
        company: ai.job.company,
        matchScore: ai.match_score,
        result: { ai, keywordOverlapPercent: overlap },
        modelVersion: MODEL_VERSION,
        promptVersion: PROMPT_VERSION,
      });
      stream.stage("score", "done");

      stream.result(matchResponse(match, await getUserCredits(user.id)));
    } catch (error) {
      console.error("Match pipeline failed after charging, refunding:", error);
      await grantCredits(user.id, CREDIT_COST.match, "refund", "match", matchId).catch(
        (refundError) => console.error("CRITICAL: failed to refund credits:", refundError)
      );
      stream.error("Something went wrong while saving your match. Please try again.");
    }
  });
}
