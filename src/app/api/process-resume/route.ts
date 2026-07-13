import { NextRequest, NextResponse } from "next/server";
import { GeminiService } from "@/lib/gemini-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser, isAuthConfigured } from "@/lib/auth";
import {
  CREDIT_COST,
  ensureMonthlyTopUp,
  getCachedScan,
  hashFile,
  recordScan,
  refundCredits,
  spendCredits,
  uploadResumePdf,
} from "@/lib/scans";

// Gemini's inlineData reliably parses PDF only, so we accept PDF exclusively.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

// A detailed report is a long Gemini generation; allow the function to run
// long enough for it (Vercel caps at 60s on Hobby, up to 300s on Pro).
export const maxDuration = 120;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP to protect the paid AI endpoint from abuse.
    const { allowed, retryAfter } = checkRateLimit(getClientIp(request));
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Hard auth gate — every request must be signed in. This is the real
    // security boundary; the UI hiding the uploader is only cosmetic.
    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: "Service unavailable." },
        { status: 503 }
      );
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to analyze your resume." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mode: "basic" | "detailed" =
      formData.get("mode") === "detailed" ? "detailed" : "basic";
    const jobDescription =
      (formData.get("jobDescription") as string)?.trim() || undefined;

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify the bytes actually are a PDF (don't trust the client MIME type).
    const isPdf = PDF_MAGIC.every((byte, i) => buffer[i] === byte);
    if (!isPdf) {
      return NextResponse.json(
        { error: "File does not appear to be a valid PDF." },
        { status: 400 }
      );
    }

    const fileHash = hashFile(buffer);

    // Signed-in gating. Every action costs credits: basic = 1, detailed = 2.
    // `cost` is tracked so it can be refunded if the analysis fails.
    const cost = mode === "detailed" ? CREDIT_COST.detailed : CREDIT_COST.basic;
    let creditsCharged = 0;

    // Apply any due monthly free top-up before checking the balance.
    await ensureMonthlyTopUp(user.id);

    // Serve a cached basic result for the same file at no charge.
    if (mode === "basic") {
      const cached = await getCachedScan(user.id, fileHash);
      if (cached) {
        return NextResponse.json({
          success: true,
          data: cached,
          cached: true,
          message: "Loaded your recent analysis for this file.",
        });
      }
    }

    const spent = await spendCredits(user.id, cost);
    if (!spent) {
      return NextResponse.json(
        {
          error: `This ${
            mode === "detailed" ? "detailed report" : "scan"
          } needs ${cost} credit${cost > 1 ? "s" : ""}. You're out of credits — buy more to keep going.`,
          code: "OUT_OF_CREDITS",
        },
        { status: 402 }
      );
    }
    creditsCharged = cost;

    const geminiService = new GeminiService();
    const result = await geminiService.processResumeWithGemini(
      buffer.toString("base64"),
      file.type,
      { mode, jobDescription }
    );

    if (!result.success) {
      // Refund — the user paid but got no result.
      if (creditsCharged > 0) {
        await refundCredits(user.id, creditsCharged).catch((e) =>
          console.error("Failed to refund credits:", e)
        );
      }
      return NextResponse.json(
        { error: result.error || "Failed to process resume" },
        { status: 502 }
      );
    }

    // Invalid job description — refund and ask the user to fix it.
    if (mode === "detailed" && result.data?.jd_invalid) {
      if (creditsCharged > 0) {
        await refundCredits(user.id, creditsCharged).catch((e) =>
          console.error("Failed to refund credits:", e)
        );
      }
      const base =
        result.data.jd_invalid_message ||
        "The text you provided doesn't look like a job description. Please paste a real job posting and try again.";
      return NextResponse.json(
        { error: `${base} You were not charged.`, code: "INVALID_JD" },
        { status: 422 }
      );
    }

    // Persist to history + store the PDF so it can be re-analyzed later
    // (best-effort; never block the response on it).
    if (result.data) {
      const resultData = result.data;
      (async () => {
        const storagePath = await uploadResumePdf(user.id, fileHash, buffer);
        await recordScan(user.id, {
          score: resultData.ats_analysis?.score,
          fileHash,
          result: resultData,
          isDetailed: mode === "detailed",
          jdProvided: !!jobDescription,
          storagePath,
          fileName: file.name,
        });
      })().catch((e) => console.error("Failed to record scan:", e));
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Resume processed successfully",
    });
  } catch (error) {
    console.error("Error processing resume:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
