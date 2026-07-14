import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getResumeById, renameResume, deleteResumeRow } from "@/lib/db/resumes";
import { deleteResumePdf } from "@/lib/storage/resume-pdf";
import { checkGeneralRateLimit } from "@/lib/rate-limit";

const MAX_DISPLAY_NAME_LENGTH = 200;

/** Renames a resume's display name. */
export async function PATCH(
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
  const body = await request.json().catch(() => null);
  const displayName =
    typeof body?.display_name === "string" ? body.display_name.trim() : "";

  if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json(
      {
        error: `Name must be between 1 and ${MAX_DISPLAY_NAME_LENGTH} characters.`,
      },
      { status: 400 }
    );
  }

  const updated = await renameResume(user.id, resumeId, displayName);
  if (!updated) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  return NextResponse.json({ resume: updated });
}

/**
 * Deletes a resume: the storage object, then the DB row (its scans and
 * matches cascade via foreign key). A GDPR requirement, not a nice-to-have.
 */
export async function DELETE(
  _request: NextRequest,
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

  try {
    await deleteResumePdf(resume.storage_path);
  } catch (error) {
    console.error("Failed to delete resume file, aborting:", error);
    return NextResponse.json(
      { error: "Could not delete this resume. Please try again." },
      { status: 500 }
    );
  }

  const deleted = await deleteResumeRow(user.id, resumeId);
  if (!deleted) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
