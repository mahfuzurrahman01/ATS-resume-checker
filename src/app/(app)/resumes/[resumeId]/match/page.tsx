import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getResumeById } from "@/lib/db/resumes";
import { MatchClient } from "./MatchClient";

export const metadata = {
  title: "Match to a Job - ATS Resume Checker",
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const { resumeId } = await params;
  const resume = await getResumeById(user.id, resumeId);
  if (!resume) notFound();

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Match {resume.display_name || resume.file_name} to a job
        </h1>
      </div>
      <MatchClient resumeId={resume.id} />
    </div>
  );
}
