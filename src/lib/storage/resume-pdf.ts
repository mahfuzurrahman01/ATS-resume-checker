import { createServiceClient } from "@/lib/supabase/server";

/**
 * Private Supabase Storage bucket for uploaded resume PDFs. Content-addressed
 * path: `${userId}/${fileHash}.pdf`, so re-uploading the same bytes overwrites
 * the same object harmlessly and dedupe is trivial.
 */

const BUCKET = "resumes";

export function resumeStoragePath(userId: string, fileHash: string): string {
  return `${userId}/${fileHash}.pdf`;
}

/** Uploads a resume PDF to private storage. Idempotent by (userId, fileHash). */
export async function uploadResumePdf(
  userId: string,
  fileHash: string,
  buffer: Buffer
): Promise<string> {
  const svc = createServiceClient();
  const path = resumeStoragePath(userId, fileHash);
  const { error } = await svc.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Failed to store resume: ${error.message}`);
  return path;
}

/** Downloads a stored resume PDF. */
export async function downloadResumePdf(storagePath: string): Promise<Buffer> {
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(
      `Failed to load resume file: ${error?.message ?? "not found"}`
    );
  }
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Deletes a stored resume PDF. Required for GDPR-compliant deletion — the DB
 * row cascading its scans/matches does not remove the underlying file.
 */
export async function deleteResumePdf(storagePath: string): Promise<void> {
  const svc = createServiceClient();
  const { error } = await svc.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Failed to delete resume file: ${error.message}`);
}

/**
 * Deletes every stored resume file for a user (their entire storage folder).
 * Used for full account deletion. DB rows are handled separately — every
 * table cascades from auth.users, but Storage objects are not part of that
 * cascade and must be removed explicitly.
 */
export async function deleteAllResumeFilesForUser(userId: string): Promise<void> {
  const svc = createServiceClient();
  const { data: files, error: listError } = await svc.storage
    .from(BUCKET)
    .list(userId);
  if (listError) {
    throw new Error(`Failed to list resume files: ${listError.message}`);
  }
  if (!files || files.length === 0) return;

  const paths = files.map((f) => `${userId}/${f.name}`);
  const { error: removeError } = await svc.storage.from(BUCKET).remove(paths);
  if (removeError) {
    throw new Error(`Failed to delete resume files: ${removeError.message}`);
  }
}

/** Signed, short-lived URL to view or download a stored resume PDF. */
export async function getSignedResumeUrl(
  storagePath: string,
  download?: string | false
): Promise<string | null> {
  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 120, download ? { download } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}
