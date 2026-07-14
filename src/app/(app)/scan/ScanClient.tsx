"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Sparkles, Coins } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { ErrorNotice } from "@/components/ui/error-notice";
import { AnalysisProgress, type ProgressStage } from "@/components/AnalysisProgress";
import { Card, CardContent } from "@/components/ui/card";
import { CreditBadge } from "@/components/ui/credit-badge";
import { Button } from "@/components/ui/button";
import { CREDIT_COST } from "@/lib/credit-costs";
import { looksLikeJobDescription } from "@/lib/utils";
import { useCredits } from "@/lib/credits-context";
import { readNdjsonStream } from "@/lib/ndjson-client";

const SCAN_STAGES: ProgressStage[] = [
  { id: "extract", label: "Reading your PDF" },
  { id: "checks", label: "Checking ATS readability" },
  { id: "ai", label: "Analyzing your content" },
  { id: "score", label: "Scoring" },
];

const MATCH_STAGES: ProgressStage[] = [
  { id: "load", label: "Loading your resume" },
  { id: "ai", label: "Analyzing the match" },
  { id: "score", label: "Calculating fit" },
];

interface ScanResultData {
  duplicate?: true;
  resume_id: string;
  credits?: { balance: number; isLifetime: boolean };
}

interface MatchResultData {
  match_id: string;
  credits?: { balance: number; isLifetime: boolean };
}

/**
 * The uploader. One job: get a PDF. A collapsed, opt-in "also match to a job
 * right away" section is the one honest shortcut the plan keeps — checking
 * it creates a scan AND a match (two records, two ledger entries), and the
 * visible price updates to reflect that before the user commits.
 */
export function ScanClient() {
  const router = useRouter();
  const creditsCtx = useCredits();

  const [includeMatch, setIncludeMatch] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const [phase, setPhase] = useState<"scan" | "match">("scan");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<string | null>(null);

  const totalCredits = includeMatch
    ? CREDIT_COST.scan + CREDIT_COST.match
    : CREDIT_COST.scan;

  const outOfCredits =
    !!creditsCtx && !creditsCtx.credits.isLifetime && creditsCtx.credits.balance <= 0;

  const runScan = async (file: File) => {
    setLastFile(file);
    setSubmitting(true);
    setError(null);
    setPhase("scan");
    setCompleted(new Set());
    setCurrent(null);

    const trimmedJd = jobDescription.trim();
    if (includeMatch && trimmedJd) {
      const check = looksLikeJobDescription(trimmedJd);
      if (!check.ok) {
        setError(check.reason ?? "That doesn't look like a job description.");
        setSubmitting(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const scanRes = await fetch("/api/scans", { method: "POST", body: formData });
      if (!scanRes.ok) {
        // Fast pre-flight failure (auth/rate-limit/bad file) — plain JSON.
        const data = await scanRes.json().catch(() => ({}));
        setError(data.error || "Failed to scan this resume.");
        setSubmitting(false);
        return;
      }

      let resumeId: string | null = null;
      let duplicate = false;
      let streamError: { message: string } | null = null;

      await readNdjsonStream<ScanResultData>(scanRes, (event) => {
        if (event.type === "stage" && event.stage) {
          if (event.status === "start") setCurrent(event.stage);
          if (event.status === "done") {
            setCompleted((prev) => new Set(prev).add(event.stage!));
            setCurrent(null);
          }
        } else if (event.type === "result" && event.data) {
          if (event.data.credits && creditsCtx) creditsCtx.setCredits(event.data.credits);
          resumeId = event.data.resume_id;
          duplicate = !!event.data.duplicate;
        } else if (event.type === "error") {
          streamError = { message: event.error || "Failed to scan this resume." };
        }
      });

      if (streamError) {
        setError((streamError as { message: string }).message);
        setSubmitting(false);
        return;
      }
      if (!resumeId) {
        setError("Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      if (duplicate) {
        // Same file already scanned — no charge. Take them straight to it;
        // they can start a fresh match from the resume page if they want one.
        router.push(`/resumes/${resumeId}`);
        return;
      }

      if (includeMatch && trimmedJd) {
        setPhase("match");
        setCompleted(new Set());
        setCurrent(null);

        const matchRes = await fetch(`/api/resumes/${resumeId}/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobDescription: trimmedJd }),
        });

        if (matchRes.ok) {
          let matchId: string | null = null;
          await readNdjsonStream<MatchResultData>(matchRes, (event) => {
            if (event.type === "stage" && event.stage) {
              if (event.status === "start") setCurrent(event.stage);
              if (event.status === "done") {
                setCompleted((prev) => new Set(prev).add(event.stage!));
                setCurrent(null);
              }
            } else if (event.type === "result" && event.data) {
              if (event.data.credits && creditsCtx) creditsCtx.setCredits(event.data.credits);
              matchId = event.data.match_id;
            }
          });
          if (matchId) {
            router.push(`/resumes/${resumeId}/matches/${matchId}`);
            return;
          }
        }
        // The scan itself already succeeded and was charged; only the
        // optional match failed. Take them to the resume so the scan isn't
        // lost, rather than stranding them on an error with no result.
        router.push(`/resumes/${resumeId}`);
        return;
      }

      router.push(`/resumes/${resumeId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (outOfCredits) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-2 border-dashed border-gray-700/50 bg-gray-900/30">
          <CardContent className="p-8 text-center space-y-4">
            <Coins className="h-10 w-10 text-gray-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-white">You&apos;re out of credits</p>
              <p className="text-sm text-gray-400 mt-1">
                Buy more credits to keep scanning resumes.
              </p>
            </div>
            <Link href="/pricing">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                Get credits
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card className="bg-gray-900/30 border border-gray-700/40">
        <CardContent className="p-4">
          <button
            type="button"
            onClick={() => setIncludeMatch((v) => !v)}
            disabled={submitting}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Also match to a job right away
            </span>
            {includeMatch ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {includeMatch && (
            <div className="mt-3 space-y-2">
              <textarea
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste the job description here…"
                rows={5}
                disabled={submitting}
                className="w-full rounded-xl bg-gray-800/60 border border-gray-700/50 p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
              />
              <p className="text-xs text-gray-500">
                This creates a scan and a match together.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <CreditBadge cost={totalCredits} className="text-sm" />
        {includeMatch && (
          <span className="ml-2 text-xs text-gray-400 self-center">
            ({CREDIT_COST.scan} scan + {CREDIT_COST.match} match)
          </span>
        )}
      </div>

      <FileUpload onFileSelect={runScan} isProcessing={submitting} />

      {submitting && (
        <AnalysisProgress
          stages={phase === "scan" ? SCAN_STAGES : MATCH_STAGES}
          completed={completed}
          current={current}
        />
      )}

      {error && (
        <ErrorNotice
          message={error}
          onRetry={lastFile ? () => runScan(lastFile) : undefined}
        />
      )}
    </div>
  );
}
