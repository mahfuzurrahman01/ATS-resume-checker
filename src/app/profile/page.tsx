import { redirect } from "next/navigation";

// The old /profile route is retired in favor of /resumes. Kept as a redirect
// so any existing bookmarks/links still land somewhere useful.
export default function ProfileRedirect() {
  redirect("/resumes");
}
