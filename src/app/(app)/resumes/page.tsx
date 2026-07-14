import { redirect } from "next/navigation";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { listResumesForUser } from "@/lib/db/resumes";
import { ResumesListClient } from "./ResumesListClient";

export const metadata = {
  title: "My Resumes - ATS Resume Checker",
};

export default async function ResumesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [resumes, credits] = await Promise.all([
    listResumesForUser(user.id),
    getUserCredits(user.id),
  ]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">My Resumes</h1>
      <ResumesListClient
        resumes={resumes}
        hasCredits={credits.isLifetime || credits.balance > 0}
      />
    </div>
  );
}
