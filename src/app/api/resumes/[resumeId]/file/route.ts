import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getResumeById } from "@/lib/db/resumes";
import { getSignedResumeUrl } from "@/lib/storage/resume-pdf";
import { checkGeneralRateLimit } from "@/lib/rate-limit";

/**
 * Redirects to a short-lived signed URL for the user's stored resume PDF.
 * `?download=1` forces a download instead of an inline view. Ownership is
 * verified (via getResumeById, scoped to the resumes table) before any URL
 * is minted.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const rateLimit = await checkGeneralRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const { resumeId } = await params;
  const resume = await getResumeById(user.id, resumeId);
  if (!resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const url = await getSignedResumeUrl(
    resume.storage_path,
    wantsDownload ? resume.file_name || "resume.pdf" : false
  );
  if (!url) {
    return NextResponse.json(
      { error: "Could not load the file." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(url);
}
