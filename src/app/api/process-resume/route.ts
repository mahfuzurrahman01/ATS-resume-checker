import { NextRequest, NextResponse } from "next/server";
import { GeminiService } from "@/lib/gemini-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser, getUserCredits, isAuthConfigured } from "@/lib/auth";
import {
  FREE_DAILY_SCANS,
  getCachedScan,
  getTodayScanCount,
  hashFile,
  recordScan,
  spendCredit,
} from "@/lib/scans";

// Gemini's inlineData reliably parses PDF only, so we accept PDF exclusively.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

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

    // Require sign-in once auth is configured. Before Supabase setup, the
    // endpoint stays open so local testing works.
    const authOn = isAuthConfigured();
    const user = await getCurrentUser();
    if (authOn && !user) {
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

    // Signed-in gating. Basic = free daily limit then credit fallback.
    // Detailed = always 1 credit (or lifetime). Both shield Gemini quota.
    if (authOn && user) {
      if (mode === "basic") {
        // Serve a cached basic result for the same file if we have one.
        const cached = await getCachedScan(user.id, fileHash);
        if (cached) {
          return NextResponse.json({
            success: true,
            data: cached,
            cached: true,
            message: "Loaded your recent analysis for this file.",
          });
        }

        const [todayCount, credits] = await Promise.all([
          getTodayScanCount(user.id),
          getUserCredits(user.id),
        ]);

        if (todayCount >= FREE_DAILY_SCANS && !credits.isLifetime) {
          const spent = await spendCredit(user.id);
          if (!spent) {
            return NextResponse.json(
              {
                error:
                  "You've used your free scans for today. Buy credits or upgrade to keep going.",
                code: "OUT_OF_CREDITS",
              },
              { status: 402 }
            );
          }
        }
      } else {
        // Detailed report always costs a credit unless the user is lifetime.
        const credits = await getUserCredits(user.id);
        if (!credits.isLifetime) {
          const spent = await spendCredit(user.id);
          if (!spent) {
            return NextResponse.json(
              {
                error:
                  "A detailed report costs 1 credit. Buy credits or upgrade to unlock it.",
                code: "OUT_OF_CREDITS",
              },
              { status: 402 }
            );
          }
        }
      }
    }

    const geminiService = new GeminiService();
    const result = await geminiService.processResumeWithGemini(
      buffer.toString("base64"),
      file.type,
      { mode, jobDescription }
    );

    if (!result.success) {
      // Note: no reliable refund path for a spent credit here; spending only
      // happens after the quota check, and Gemini failures are rare. Logged
      // for follow-up if it becomes an issue.
      return NextResponse.json(
        { error: result.error || "Failed to process resume" },
        { status: 502 }
      );
    }

    // Persist to history (best-effort; never block the response on it).
    if (authOn && user && result.data) {
      recordScan(user.id, {
        score: result.data.ats_analysis?.score,
        fileHash,
        result: result.data,
        isDetailed: mode === "detailed",
        jdProvided: !!jobDescription,
      }).catch((e) => console.error("Failed to record scan:", e));
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
