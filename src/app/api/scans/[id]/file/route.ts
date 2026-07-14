import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getScanById, getSignedResumeUrl } from "@/lib/scans";

/**
 * Redirects to a short-lived signed URL for the user's stored resume PDF.
 * `?download=1` forces a download instead of inline view. Ownership is
 * verified before any URL is minted.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  const scan = await getScanById(user.id, id);
  if (!scan?.storage_path) {
    return NextResponse.json(
      { error: "File not found." },
      { status: 404 }
    );
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const url = await getSignedResumeUrl(
    scan.storage_path,
    wantsDownload ? scan.file_name || "resume.pdf" : false
  );
  if (!url) {
    return NextResponse.json(
      { error: "Could not load the file." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(url);
}
