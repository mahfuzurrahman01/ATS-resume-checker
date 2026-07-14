import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkGeneralRateLimit } from "@/lib/rate-limit";
import { deleteAllResumeFilesForUser } from "@/lib/storage/resume-pdf";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Permanently deletes the signed-in user's account: every stored resume
 * file, and (via the service role) the auth.users row itself. Every table
 * in the schema has `ON DELETE CASCADE` to auth.users (migration 0004), so
 * deleting the user row wipes all their DB data — resumes, scans, matches,
 * credits, credit_ledger, profiles — automatically. Storage objects are not
 * part of that cascade, so we remove them explicitly first.
 *
 * Requires the caller to confirm by sending their own email back, matching
 * the /settings UI's "type your email to confirm" flow. Irreversible.
 */
export async function DELETE(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const confirmEmail =
    typeof body?.confirmEmail === "string" ? body.confirmEmail.trim() : "";

  if (
    !confirmEmail ||
    confirmEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Email doesn't match. Type your email exactly to confirm." },
      { status: 400 }
    );
  }

  try {
    await deleteAllResumeFilesForUser(user.id);
  } catch (error) {
    console.error("Failed to delete resume files, aborting:", error);
    return NextResponse.json(
      { error: "Could not delete your files. Please try again." },
      { status: 500 }
    );
  }

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Failed to delete auth user:", error);
    return NextResponse.json(
      {
        error:
          "Your files were deleted, but we couldn't finish deleting your account. Please contact us.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
