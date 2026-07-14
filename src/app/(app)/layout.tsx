import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * Auth guard for every protected route (/scan, /resumes/*, /settings).
 * Lives once here, not duplicated per page. Pages under this segment can
 * still call getCurrentUser() themselves to get the id for their own data
 * loading — it's memoized per-request, so this costs one extra function
 * call, not a second auth round trip.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <>{children}</>;
}
