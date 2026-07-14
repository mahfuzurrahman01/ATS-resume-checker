import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  Target,
  CheckCircle,
  XCircle,
  Briefcase,
  ArrowRight,
  Eye,
  Download,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getResumeById } from "@/lib/db/resumes";
import { getLatestScanForResume } from "@/lib/db/scans";
import { listMatchesForResume } from "@/lib/db/matches";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/score-badge";
import { CATEGORY_MAX } from "@/lib/analysis/score";
import type { CheckCategory } from "@/lib/analysis/checks";

export const metadata = {
  title: "Resume - ATS Resume Checker",
};

const CATEGORY_LABEL: Record<CheckCategory, string> = {
  parseability: "Parseability",
  structure: "Structure",
  contact: "Contact",
  content: "Content",
  formatting: "Formatting",
};

const CATEGORIES: CheckCategory[] = [
  "parseability",
  "structure",
  "contact",
  "content",
  "formatting",
];

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const { resumeId } = await params;
  const resume = await getResumeById(user.id, resumeId);
  if (!resume) notFound();

  const [scan, matches] = await Promise.all([
    getLatestScanForResume(resume.id),
    listMatchesForResume(resume.id),
  ]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {resume.display_name || resume.file_name}
          </h1>
          <p className="text-xs text-gray-400">
            Uploaded {new Date(resume.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/resumes/${resume.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-900/40 border-gray-700/40 text-gray-200 hover:bg-gray-800/40"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </a>
          <a href={`/api/resumes/${resume.id}/file?download=1`}>
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-900/40 border-gray-700/40 text-gray-200 hover:bg-gray-800/40"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </a>
        </div>
      </div>

      {!scan ? (
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-8 text-center text-gray-300">
            This resume hasn&apos;t been scanned yet.
          </CardContent>
        </Card>
      ) : scan.prompt_version === "legacy" ? (
        // Backfilled from the pre-rebuild system: it only has an old,
        // AI-guessed overall score — no deterministic subscores, checks, or
        // structured findings exist for it. Say so honestly instead of
        // rendering sections built on data this row never had.
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-gray-300">
              This resume was scanned before the current scoring engine.
              {scan.score != null && (
                <>
                  {" "}
                  Its old score was{" "}
                  <span className="text-white font-medium">
                    {scan.score}/100
                  </span>
                  .
                </>
              )}
            </p>
            <p className="text-sm text-gray-400">
              Re-scan it to get the full deterministic breakdown, checks, and
              AI feedback.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score */}
          <Card className="bg-gray-900/20 border border-gray-700/30">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  ATS Score
                </span>
                <ScoreBadge score={scan.score} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-3 text-center"
                  >
                    <p className="text-lg font-bold text-white">
                      {scan.subscores[cat].earned}
                      <span className="text-sm text-gray-400">
                        /{CATEGORY_MAX[cat]}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABEL[cat]}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Deterministic checks */}
          <Card className="bg-gray-900/20 border border-gray-700/30">
            <CardHeader>
              <CardTitle className="text-white">Checks</CardTitle>
              <CardDescription className="text-gray-300">
                Mechanical, deterministic checks — the same file always
                produces the same results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {scan.result.checks
                .filter((c) => !c.passed)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 rounded-xl bg-gray-800/40 border border-gray-700/40 p-3"
                  >
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {c.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.detail}
                      </p>
                      <p className="text-xs text-purple-300 mt-1">{c.fix}</p>
                    </div>
                  </div>
                ))}
              {scan.result.checks.every((c) => c.passed) && (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  All checks passed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI content findings */}
          {scan.result.ai.content_findings.length > 0 && (
            <Card className="bg-gray-900/20 border border-gray-700/30">
              <CardHeader>
                <CardTitle className="text-white">Content Findings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scan.result.ai.content_findings.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {f.finding}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{f.evidence}</p>
                    <p className="text-xs text-purple-300 mt-1">{f.fix}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Bullet rewrites */}
          {scan.result.ai.bullet_rewrites.length > 0 && (
            <Card className="bg-gray-900/20 border border-gray-700/30">
              <CardHeader>
                <CardTitle className="text-white">Bullet Rewrites</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scan.result.ai.bullet_rewrites.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-3 space-y-1"
                  >
                    <p className="text-sm text-gray-400 line-through">
                      {b.original}
                    </p>
                    <p className="text-sm text-white font-medium">
                      {b.rewritten}
                    </p>
                    <p className="text-xs text-gray-500">{b.why}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {scan.result.ai.summary && (
            <p className="text-sm text-gray-300">{scan.result.ai.summary}</p>
          )}
        </>
      )}

      {/* Match to a job CTA */}
      <Card className="border-2 border-dashed border-purple-500/40 bg-gray-900/30">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">Match this resume to a job</p>
            <p className="text-sm text-gray-400">
              See how well it fits a specific role.
            </p>
          </div>
          <Link href={`/resumes/${resume.id}/match`}>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              Match to a job
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Matches list */}
      {matches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">
            Job matches ({matches.length})
          </h2>
          <div className="space-y-2">
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/resumes/${resume.id}/matches/${m.id}`}
              >
                <Card className="bg-gray-900/20 border border-gray-700/30 hover:border-purple-500/40 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="h-4 w-4 text-purple-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {m.job_title || "Job match"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(m.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-blue-700/40 bg-blue-900/40 px-2.5 py-1 text-sm font-semibold text-blue-300">
                      {m.match_score}%
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
