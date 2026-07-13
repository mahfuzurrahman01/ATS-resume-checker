import { NextRequest, NextResponse } from "next/server";
import { GeminiService } from "@/lib/gemini-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser, getUserCredits, isAuthConfigured } from "@/lib/auth";
import {
  CREDIT_COST,
  downloadResumePdf,
  ensureMonthlyTopUp,
  getScanById,
  recordScan,
  refundCredits,
  spendCredits,
} from "@/lib/scans";

export const maxDuration = 120;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Runs a fresh detailed report on a previously scanned resume against a new
 * job description. Costs 1 credit (or free for lifetime members).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: "Sign-in is not configured." },
        { status: 401 }
      );
    }

    const { allowed, retryAfter } = checkRateLimit(getClientIp(request));
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const { id } = await params;
    const scan = await getScanById(user.id, id);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }
    if (!scan.storage_path) {
      return NextResponse.json(
        {
          error:
            "The original file for this scan isn't stored. Please re-upload it.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const jobDescription =
      typeof body.jobDescription === "string"
        ? body.jobDescription.trim() || undefined
        : undefined;

    const pdf = await downloadResumePdf(scan.storage_path);
    if (!pdf) {
      return NextResponse.json(
        { error: "Could not load the stored resume. Please re-upload it." },
        { status: 404 }
      );
    }

    // A detailed report costs 2 credits (unless lifetime). Top up first.
    await ensureMonthlyTopUp(user.id);
    const cost = CREDIT_COST.detailed;
    const creditsCharged = (await spendCredits(user.id, cost)) ? cost : -1;
    if (creditsCharged < 0) {
      return NextResponse.json(
        {
          error: `A detailed report needs ${cost} credit${
            cost > 1 ? "s" : ""
          }. You're out of credits — buy more to keep going.`,
          code: "OUT_OF_CREDITS",
          credits: await getUserCredits(user.id),
        },
        { status: 402 }
      );
    }

    const gemini = new GeminiService();
    const result = await gemini.processResumeWithGemini(
      pdf.toString("base64"),
      "application/pdf",
      { mode: "detailed", jobDescription }
    );

    if (!result.success || !result.data) {
      await refundCredits(user.id, creditsCharged).catch((e) =>
        console.error("Failed to refund credits:", e)
      );
      return NextResponse.json(
        { error: result.error || "Failed to generate report" },
        { status: 502 }
      );
    }

    // Invalid job description — refund and ask the user to fix it.
    if (result.data.jd_invalid) {
      await refundCredits(user.id, creditsCharged).catch((e) =>
        console.error("Failed to refund credits:", e)
      );
      const base =
        result.data.jd_invalid_message ||
        "The text you provided doesn't look like a job description. Please paste a real job posting and try again.";
      return NextResponse.json(
        {
          error: `${base} You were not charged.`,
          code: "INVALID_JD",
          credits: await getUserCredits(user.id),
        },
        { status: 422 }
      );
    }

    // Save as a new detailed scan tied to the same stored file.
    const resultData = result.data;
    recordScan(user.id, {
      score: resultData.ats_analysis?.score,
      fileHash: scan.file_hash ?? scan.storage_path,
      result: resultData,
      isDetailed: true,
      jdProvided: !!jobDescription,
      storagePath: scan.storage_path,
      fileName: scan.file_name,
    }).catch((e) => console.error("Failed to record scan:", e));

    return NextResponse.json({
      success: true,
      data: resultData,
      credits: await getUserCredits(user.id),
    });
  } catch (error) {
    console.error("Error generating detailed report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
