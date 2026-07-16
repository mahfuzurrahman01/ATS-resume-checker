import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMatchById } from "@/lib/db/matches";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Job Match",
};

const VERDICT_LABEL: Record<string, string> = {
  strong: "Strong Fit",
  possible: "Possible Fit",
  stretch: "Stretch",
  overqualified: "Overqualified",
  "not-a-fit": "Not a Fit",
};

const VERDICT_CLASS: Record<string, string> = {
  strong: "bg-green-900/50 text-green-300 border-green-700/40",
  possible: "bg-blue-900/50 text-blue-300 border-blue-700/40",
  stretch: "bg-yellow-900/50 text-yellow-300 border-yellow-700/40",
  overqualified: "bg-purple-900/50 text-purple-300 border-purple-700/40",
  "not-a-fit": "bg-red-900/50 text-red-300 border-red-700/40",
};

function statusIcon(status: string) {
  if (status === "met") return <CheckCircle className="h-4 w-4 text-green-400" />;
  if (status === "partial") return <MinusCircle className="h-4 w-4 text-yellow-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
}

export default async function MatchResultPage({
  params,
}: {
  params: Promise<{ resumeId: string; matchId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const { resumeId, matchId } = await params;
  const match = await getMatchById(user.id, matchId);
  if (!match || match.resume_id !== resumeId) notFound();

  const backButton = (
    <Link href={`/resumes/${resumeId}`}>
      <Button
        variant="outline"
        size="sm"
        className="bg-gray-900/40 border-gray-700/40 text-gray-200 hover:bg-gray-800/40"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to resume
      </Button>
    </Link>
  );

  if (match.prompt_version === "legacy") {
    // Backfilled from the pre-rebuild system: the old result shape has no
    // `.ai`/`.keywordOverlapPercent` fields this page renders. Say so
    // honestly instead of crashing on data this row never had.
    return (
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        {backButton}
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-gray-300">
              This match was run before the current matching engine.
              {match.match_score != null && (
                <>
                  {" "}
                  Its old score was{" "}
                  <span className="text-white font-medium">
                    {match.match_score}%
                  </span>
                  .
                </>
              )}
            </p>
            <p className="text-sm text-gray-400">
              Run a new match to get the full breakdown, keyword overlap, and
              tailored rewrites.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { ai } = match.result;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
      {backButton}

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span>{match.job_title || "Job match"}</span>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${VERDICT_CLASS[ai.verdict]}`}
            >
              {VERDICT_LABEL[ai.verdict]}
            </span>
          </CardTitle>
          {match.company && (
            <CardDescription className="text-gray-300">
              {match.company}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-white">
                {match.match_score}%
              </p>
              <p className="text-xs text-gray-400">AI assessment</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-300">
                {match.result.keywordOverlapPercent}%
              </p>
              <p className="text-xs text-gray-400">Keyword overlap</p>
            </div>
          </div>
          <p className="text-sm text-gray-300">{ai.verdict_reason}</p>
          {ai.biggest_gap && (
            <p className="text-sm text-yellow-300">
              Biggest gap: {ai.biggest_gap}
            </p>
          )}
        </CardContent>
      </Card>

      {ai.requirements.length > 0 && (
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardHeader>
            <CardTitle className="text-white">Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ai.requirements.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-gray-800/40 border border-gray-700/40 p-3"
              >
                {statusIcon(r.status)}
                <div>
                  <p className="text-sm text-white">
                    {r.requirement}{" "}
                    <span className="text-xs text-gray-500">
                      ({r.type === "must-have" ? "must-have" : "nice-to-have"})
                    </span>
                  </p>
                  {r.evidence && (
                    <p className="text-xs text-gray-400 mt-0.5">{r.evidence}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-white">Keywords</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-semibold text-green-400 mb-2">
              Matched ({ai.keywords.matched.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {ai.keywords.matched.map((k, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded-full bg-green-900/50 text-green-300 border border-green-700/30"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-400 mb-2">
              Missing critical ({ai.keywords.missing_critical.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {ai.keywords.missing_critical.map((k, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded-full bg-red-900/50 text-red-300 border border-red-700/30"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-2">
              Missing optional ({ai.keywords.missing_optional.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {ai.keywords.missing_optional.map((k, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-300 border border-gray-700/40"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {ai.bullet_rewrites.length > 0 && (
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardHeader>
            <CardTitle className="text-white">Tailored Bullet Rewrites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ai.bullet_rewrites.map((b, i) => (
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

      {ai.tailored_summary && (
        <p className="text-sm text-gray-300">{ai.tailored_summary}</p>
      )}
    </div>
  );
}
