import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { checkScanRateLimit } from "@/lib/rate-limit";
import { sha256Hex } from "@/lib/hash";
import { extractPdf } from "@/lib/pdf/extract";
import { runChecks } from "@/lib/analysis/checks";
import { computeScore } from "@/lib/analysis/score";
import { MODEL_VERSION, generateJson, AiError } from "@/lib/ai/client";
import {
  PROMPT_VERSION,
  SCAN_SYSTEM_PROMPT,
  SCAN_TIMEOUT_MS,
  scanSchema,
  buildScanUserInput,
  type ScanResult,
} from "@/lib/ai/scan-prompt";
import { findResumeByHash, createResume } from "@/lib/db/resumes";
import {
  findCachedScan,
  getLatestScanForResume,
  createScan,
  type ScanRow,
} from "@/lib/db/scans";
import { uploadResumePdf } from "@/lib/storage/resume-pdf";
import {
  spendCredits,
  grantCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { CREDIT_COST } from "@/lib/credit-costs";
import { ndjsonResponse, type StreamController } from "@/lib/streaming";

// Gemini's inlineData reliably parses PDF only, so we accept PDF exclusively.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const MIN_WORDS_TO_ATTEMPT = 50;

// A scanned/image-only PDF has no text an AI could read, so we never call
// Gemini for it — this stub fills the same shape a real scan result has.
const NO_TEXT_LAYER_STUB_AI: ScanResult = {
  is_resume: true,
  rejection_reason: null,
  header: {
    name: null,
    title: null,
    email: null,
    phone: null,
    location: null,
    links: [],
  },
  sections: {
    experience: [],
    education: [],
    skills: { technical: [], soft: [] },
    certifications: [],
  },
  content_findings: [],
  bullet_rewrites: [],
  summary:
    "This PDF has no readable text layer, so its content couldn't be analyzed. See the Parseability section below for why this happens and how to fix it.",
};

interface ScanResultPayload {
  duplicate?: true;
  resume_id: string;
  latest_scan_id?: string | null;
  scan_id?: string;
  score?: number;
  subscores?: ScanRow["subscores"];
  checks?: ScanRow["result"]["checks"];
  ai?: ScanRow["result"]["ai"];
  credits: { balance: number; isLifetime: boolean };
}

function scanResponse(
  scan: ScanRow,
  credits: { balance: number; isLifetime: boolean }
): ScanResultPayload {
  return {
    resume_id: scan.resume_id,
    scan_id: scan.id,
    score: scan.score,
    subscores: scan.subscores,
    checks: scan.result.checks,
    ai: scan.result.ai,
    credits,
  };
}

export async function POST(request: NextRequest) {
  // --- Fast pre-flight checks: plain JSON + real status codes. Nothing to
  // show progress for yet. ---------------------------------------------
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to analyze your resume." },
      { status: 401 }
    );
  }

  const rateLimit = await checkScanRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const force = request.nextUrl.searchParams.get("force") === "true";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Invalid file type. Please upload a PDF file." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Please upload a file smaller than 10MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = PDF_MAGIC.every((byte, i) => buffer[i] === byte);
  if (!isPdf) {
    return NextResponse.json(
      { error: "File does not appear to be a valid PDF." },
      { status: 400 }
    );
  }

  // --- From here on: one continuous NDJSON stream. Every path below ends
  // in exactly one result() or error() call. ----------------------------
  return ndjsonResponse<ScanResultPayload>(async (stream) => {
    const fileHash = sha256Hex(buffer);

    // DEDUPE: an existing resume for this (user, hash) means no new resume
    // and no charge, unless the caller explicitly asks to force a rescan.
    const existingResume = await findResumeByHash(user.id, fileHash);
    if (existingResume && !force) {
      const latestScan = await getLatestScanForResume(existingResume.id);
      stream.result({
        duplicate: true,
        resume_id: existingResume.id,
        latest_scan_id: latestScan?.id ?? null,
        credits: await getUserCredits(user.id),
      });
      return;
    }

    stream.stage("extract", "start");
    const extraction = await extractPdf(buffer);
    stream.stage("extract", "done");

    stream.stage("checks", "start");
    const checks = runChecks(extraction);
    stream.stage("checks", "done");

    // Cache: an existing resume being force-rescanned may already have a
    // scan for this exact (file, prompt, model) triple — same answer, free.
    if (existingResume) {
      const cached = await findCachedScan(existingResume.id, PROMPT_VERSION, MODEL_VERSION);
      if (cached) {
        stream.result(scanResponse(cached, await getUserCredits(user.id)));
        return;
      }
    }

    // SCANNED / IMAGE-ONLY PDF: this is a real result, not an error. No AI
    // call (nothing readable to send it) and no charge (no analysis was
    // actually rendered) — score is forced to 0 by the hard rule in
    // computeScore(), with the fix explained right in the checks.
    if (!extraction.hasTextLayer) {
      await persistAndRespond({
        stream,
        userId: user.id,
        fileHash,
        fileName: file.name,
        buffer,
        extraction,
        checks,
        ai: NO_TEXT_LAYER_STUB_AI,
        existingResume,
        creditsCharged: false,
      });
      return;
    }

    // GUARDRAIL, before charging: some text exists but not enough to be a
    // real resume (as opposed to no text at all, handled above).
    if (extraction.wordCount < MIN_WORDS_TO_ATTEMPT) {
      stream.error(
        "This document doesn't have enough readable text to analyze. Please upload a resume PDF.",
        "NOT_A_RESUME"
      );
      return;
    }

    stream.stage("ai", "start");
    let ai: ScanResult;
    try {
      ai = await generateJson({
        systemPrompt: SCAN_SYSTEM_PROMPT,
        userText: buildScanUserInput(extraction.text, checks),
        schema: scanSchema,
        timeoutMs: SCAN_TIMEOUT_MS,
      });
    } catch (error) {
      const message =
        error instanceof AiError
          ? error.userMessage
          : "Something went wrong while analyzing your resume. Please try again.";
      stream.error(message);
      return;
    }
    stream.stage("ai", "done");

    if (!ai.is_resume) {
      stream.error(
        ai.rejection_reason ||
          "This document doesn't look like a resume. Please upload a resume PDF.",
        "NOT_A_RESUME"
      );
      return;
    }

    // ONLY NOW, on a fully valid result, charge the credit.
    const scanId = randomUUID();
    try {
      await spendCredits(user.id, CREDIT_COST.scan, "scan", "scan", scanId);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        stream.error(
          "You're out of credits. Buy more credits to keep scanning.",
          "OUT_OF_CREDITS"
        );
        return;
      }
      throw error;
    }

    await persistAndRespond({
      stream,
      userId: user.id,
      fileHash,
      fileName: file.name,
      buffer,
      extraction,
      checks,
      ai,
      existingResume,
      creditsCharged: true,
      scanId,
    });
  });
}

/**
 * Shared "compute score, store the file, persist the rows, respond" tail
 * used by both the normal AI-scored path and the free no-text-layer path.
 * Refunds the credit (if one was charged) on any failure from here on.
 */
async function persistAndRespond(params: {
  stream: StreamController<ScanResultPayload>;
  userId: string;
  fileHash: string;
  fileName: string;
  buffer: Buffer;
  extraction: Awaited<ReturnType<typeof extractPdf>>;
  checks: ReturnType<typeof runChecks>;
  ai: ScanResult;
  existingResume: Awaited<ReturnType<typeof findResumeByHash>>;
  creditsCharged: boolean;
  scanId?: string;
}) {
  const {
    stream,
    userId,
    fileHash,
    fileName,
    buffer,
    extraction,
    checks,
    ai,
    existingResume,
    creditsCharged,
  } = params;
  const scanId = params.scanId ?? randomUUID();

  try {
    stream.stage("score", "start");
    const score = computeScore(checks);

    const resume =
      existingResume ??
      (await (async () => {
        const storagePath = await uploadResumePdf(userId, fileHash, buffer);
        return createResume({
          userId,
          fileHash,
          fileName,
          storagePath,
          pageCount: extraction.pageCount,
          hasTextLayer: extraction.hasTextLayer,
        });
      })());

    const scan = await createScan({
      id: scanId,
      resumeId: resume.id,
      userId,
      score: score.total,
      subscores: score.subscores,
      result: { ai, checks },
      modelVersion: MODEL_VERSION,
      promptVersion: PROMPT_VERSION,
    });
    stream.stage("score", "done");

    stream.result(scanResponse(scan, await getUserCredits(userId)));
  } catch (error) {
    console.error("Scan pipeline failed after charging, refunding:", error);
    if (creditsCharged) {
      await grantCredits(userId, CREDIT_COST.scan, "refund", "scan", scanId).catch(
        (refundError) => console.error("CRITICAL: failed to refund credit:", refundError)
      );
    }
    stream.error("Something went wrong while saving your scan. Please try again.");
  }
}
