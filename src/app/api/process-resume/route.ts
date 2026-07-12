import { NextRequest, NextResponse } from "next/server";
import { GeminiService } from "@/lib/gemini-service";
import { checkRateLimit } from "@/lib/rate-limit";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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

    const geminiService = new GeminiService();
    const result = await geminiService.processResumeWithGemini(
      buffer.toString("base64"),
      file.type
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to process resume" },
        { status: 502 }
      );
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
