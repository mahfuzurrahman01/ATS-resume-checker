"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Target, Coins } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/ui/credit-badge";
import { ErrorNotice } from "@/components/ui/error-notice";
import { AnalysisProgress, type ProgressStage } from "@/components/AnalysisProgress";
import { CREDIT_COST } from "@/lib/credit-costs";
import { looksLikeJobDescription } from "@/lib/utils";
import { useCredits } from "@/lib/credits-context";
import { readNdjsonStream } from "@/lib/ndjson-client";

const MATCH_STAGES: ProgressStage[] = [
  { id: "load", label: "Loading your resume" },
  { id: "ai", label: "Analyzing the match" },
  { id: "score", label: "Calculating fit" },
];

interface MatchResultData {
  match_id: string;
  credits?: { balance: number; isLifetime: boolean };
}

export function MatchClient({ resumeId }: { resumeId: string }) {
  const router = useRouter();
  const creditsCtx = useCredits();

  const [jobDescription, setJobDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<string | null>(null);

  const outOfCredits =
    !!creditsCtx && !creditsCtx.credits.isLifetime && creditsCtx.credits.balance <= 0;

  const submit = async () => {
    const trimmed = jobDescription.trim();
    const check = looksLikeJobDescription(trimmed);
    if (!check.ok) {
      setError(check.reason ?? "That doesn't look like a job description.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setCompleted(new Set());
    setCurrent(null);

    try {
      const res = await fetch(`/api/resumes/${resumeId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: trimmed }),
      });

      if (!res.ok) {
        // Fast pre-flight failure (auth/ownership/rate-limit/bad JD) — plain JSON.
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to match this resume.");
        setSubmitting(false);
        return;
      }

      let matchId: string | null = null;
      let streamError: string | null = null;

      await readNdjsonStream<MatchResultData>(res, (event) => {
        if (event.type === "stage" && event.stage) {
          if (event.status === "start") setCurrent(event.stage);
          if (event.status === "done") {
            setCompleted((prev) => new Set(prev).add(event.stage!));
            setCurrent(null);
          }
        } else if (event.type === "result" && event.data) {
          if (event.data.credits && creditsCtx) creditsCtx.setCredits(event.data.credits);
          matchId = event.data.match_id;
        } else if (event.type === "error") {
          streamError = event.error || "Failed to match this resume.";
        }
      });

      if (streamError) {
        setError(streamError);
        setSubmitting(false);
        return;
      }
      if (!matchId) {
        setError("Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push(`/resumes/${resumeId}/matches/${matchId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (outOfCredits) {
    return (
      <Card className="border-2 border-dashed border-gray-700/50 bg-gray-900/30">
        <CardContent className="p-8 text-center space-y-4">
          <Coins className="h-10 w-10 text-gray-500 mx-auto" />
          <div>
            <p className="text-lg font-semibold text-white">You&apos;re out of credits</p>
            <p className="text-sm text-gray-400 mt-1">
              Buy more credits to match this resume to a job.
            </p>
          </div>
          <Link href="/pricing">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              Get credits
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-900/30 border border-purple-500/40">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-400" />
              Paste the job description
            </span>
            <CreditBadge cost={CREDIT_COST.match} />
          </CardTitle>
          <CardDescription className="text-gray-300">
            This costs {CREDIT_COST.match} credits — you&apos;ll see the price
            before it charges anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={jobDescription}
            onChange={(e) => {
              setJobDescription(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste the job description here…"
            rows={8}
            disabled={submitting}
            className="w-full rounded-xl bg-gray-800/60 border border-gray-700/50 p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
          />
          {error && <ErrorNotice message={error} onRetry={submit} />}
          <Button
            onClick={submit}
            disabled={submitting}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {submitting
              ? "Matching…"
              : `Match to this job (${CREDIT_COST.match} credits)`}
          </Button>
        </CardContent>
      </Card>

      {submitting && (
        <AnalysisProgress stages={MATCH_STAGES} completed={completed} current={current} />
      )}
    </div>
  );
}
