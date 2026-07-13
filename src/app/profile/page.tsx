import { redirect } from "next/navigation";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { getUserScans } from "@/lib/scans";
import { ProfileClient } from "@/components/ProfileClient";

export const metadata = {
  title: "My Resumes - ATS Resume Checker",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [credits, scans] = await Promise.all([
    getUserCredits(user.id),
    getUserScans(user.id),
  ]);

  return <ProfileClient user={user} credits={credits} scans={scans} />;
}
