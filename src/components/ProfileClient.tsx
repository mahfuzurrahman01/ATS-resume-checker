"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Coins,
  Crown,
  Plus,
  Target,
  Sparkles,
  ArrowLeft,
  Eye,
  Download,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { DetailedReport } from "@/components/DetailedReport";
import type { ResumeData } from "@/lib/gemini-service";
import type { ResumeGroup, JobMatch } from "@/lib/scans";
import type { CurrentUser, UserCredits } from "@/lib/auth";
import { looksLikeJobDescription } from "@/lib/utils";
import { useCredits } from "@/lib/credits-context";
import { CREDIT_COST } from "@/lib/credit-costs";

type Tab = "all" | "unmatched" | "matched";

interface ProfileClientProps {
  user: CurrentUser;
  credits: UserCredits;
  resumes: ResumeGroup[];
}

export function ProfileClient({ user, credits, resumes }: ProfileClientProps) {
  const creditsCtx = useCredits();
  const liveCredits = creditsCtx?.credits ?? credits;

  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<ResumeGroup | null>(null);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);

  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openResume = (resume: ResumeGroup) => {
    setSelected(resume);
    setMatches(resume.jobMatches);
    setOpenMatchId(null);
    setJd("");
    setError(null);
  };

  const runMatch = async () => {
    if (!selected) return;
    const trimmed = jd.trim();
    const check = looksLikeJobDescription(trimmed);
    if (!check.ok) {
      setError(check.reason ?? "Please paste a valid job description.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/scans/${selected.representativeScanId}/detailed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobDescription: trimmed }),
        }
      );
      const data = await res.json();
      if (data?.credits && creditsCtx) creditsCtx.setCredits(data.credits);
      if (!res.ok) throw new Error(data.error || "Failed to generate report");

      const result = data.data as ResumeData;
      const fresh: JobMatch = {
        scanId: `fresh-${Date.now()}`,
        createdAt: new Date().toISOString(),
        jobTitle: result.jd_match?.job_title || "Job match",
        matchScore: result.jd_match?.match_score ?? null,
        result,
      };
      setMatches((m) => [fresh, ...m]);
      setOpenMatchId(fresh.scanId);
      setJd("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ---- Detail view -------------------------------------------------------
  if (selected) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelected(null)}
          className="mb-6 bg-gray-900/40 border-gray-700/40 text-gray-200 hover:bg-gray-800/40"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to my resumes
        </Button>

        {/* File header + preview/download */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">
                {selected.fileName || "Resume.pdf"}
              </p>
              <p className="text-xs text-gray-400">
                Uploaded {new Date(selected.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <FileActions scanId={selected.representativeScanId} />
        </div>

        <ResultsDisplay
          data={selected.result}
          onReset={() => setSelected(null)}
        />

        {/* Match to a new job */}
        <Card className="mt-6 border-2 border-dashed border-purple-500/40 bg-gray-900/30 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-400" />
                <span>Match this resume to a job</span>
              </span>
              <CreditBadge cost={CREDIT_COST.detailed} />
            </CardTitle>
            <CardDescription className="text-gray-300">
              Paste a job description to check fit, missing keywords, and get
              bullet rewrites. Costs {CREDIT_COST.detailed} credit
              {CREDIT_COST.detailed === 1 ? "" : "s"}
              {liveCredits.isLifetime ? " (free for lifetime members)" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={jd}
              onChange={(e) => {
                setJd(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste the job description here…"
              rows={5}
              disabled={loading}
              className="w-full rounded-xl bg-gray-800/60 border border-gray-700/50 p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
            />
            {error && <ErrorNotice message={error} onRetry={runMatch} />}
            <Button
              onClick={runMatch}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {loading
                ? "Analyzing…"
                : `Generate Job Match (${CREDIT_COST.detailed} credit${
                    CREDIT_COST.detailed === 1 ? "" : "s"
                  })`}
            </Button>
          </CardContent>
        </Card>

        {/* Job matches on this resume */}
        {matches.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-3">
              Job matches ({matches.length})
            </h3>
            <div className="space-y-3">
              {matches.map((m) => (
                <MatchRow
                  key={m.scanId}
                  match={m}
                  open={openMatchId === m.scanId}
                  onToggle={() =>
                    setOpenMatchId(openMatchId === m.scanId ? null : m.scanId)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- List view ---------------------------------------------------------
  const matched = resumes.filter((r) => r.hasJobMatch);
  const unmatched = resumes.filter((r) => !r.hasJobMatch);
  const shown =
    tab === "matched" ? matched : tab === "unmatched" ? unmatched : resumes;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center space-x-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name || user.email}
              className="h-14 w-14 rounded-full border border-gray-600"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold text-white">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user.name || "Welcome back"}
            </h1>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center space-x-1.5 rounded-full bg-gray-900/60 border border-gray-700/40 px-3 py-1.5 text-sm text-gray-200">
            {liveCredits.isLifetime ? (
              <>
                <Crown className="h-4 w-4 text-yellow-400" />
                <span>Lifetime</span>
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 text-purple-400" />
                <span>
                  {liveCredits.balance} credit
                  {liveCredits.balance === 1 ? "" : "s"}
                </span>
              </>
            )}
          </span>
          <Link href="/">
            <Button
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New scan
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          All ({resumes.length})
        </TabButton>
        <TabButton
          active={tab === "unmatched"}
          onClick={() => setTab("unmatched")}
        >
          Not matched ({unmatched.length})
        </TabButton>
        <TabButton active={tab === "matched"} onClick={() => setTab("matched")}>
          Matched ({matched.length})
        </TabButton>
      </div>

      {shown.length === 0 ? (
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-10 text-center">
            <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-300 mb-4">
              {tab === "matched"
                ? "No matched resumes yet. Open a resume and match it to a job."
                : resumes.length === 0
                ? "You haven't scanned any resumes yet."
                : "Nothing here."}
            </p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                Scan a resume
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((resume) => (
            <ResumeCard
              key={resume.fileHash}
              resume={resume}
              onOpen={() => openResume(resume)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-purple-600 text-white"
          : "bg-gray-900/50 text-gray-300 border border-gray-700/40 hover:bg-gray-800/50"
      }`}
    >
      {children}
    </button>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 80
      ? "bg-green-900/50 text-green-300 border-green-700/40"
      : score >= 60
      ? "bg-yellow-900/50 text-yellow-300 border-yellow-700/40"
      : "bg-red-900/50 text-red-300 border-red-700/40";
  return (
    <span
      className={`flex-shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${color}`}
    >
      {score}/100
    </span>
  );
}

function FileActions({ scanId }: { scanId: string }) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/scans/${scanId}/file`}
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
      <a href={`/api/scans/${scanId}/file?download=1`}>
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
  );
}

function ResumeCard({
  resume,
  onOpen,
}: {
  resume: ResumeGroup;
  onOpen: () => void;
}) {
  return (
    <Card className="bg-gray-900/20 border border-gray-700/30 hover:border-purple-500/40 hover:bg-gray-900/40 transition-colors">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <button
          onClick={onOpen}
          className="flex items-center space-x-3 min-w-0 text-left flex-1"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {resume.fileName || "Resume.pdf"}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(resume.uploadedAt).toLocaleDateString()}
              {resume.hasJobMatch && (
                <span className="ml-2 inline-flex items-center gap-1 text-purple-300">
                  <Briefcase className="h-3 w-3" />
                  {resume.jobMatches.length} job match
                  {resume.jobMatches.length === 1 ? "" : "es"}
                </span>
              )}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <ScoreBadge score={resume.score} />
        </div>
      </CardContent>
    </Card>
  );
}

function MatchRow({
  match,
  open,
  onToggle,
}: {
  match: JobMatch;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="bg-gray-900/20 border border-gray-700/30">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-4 w-4 text-purple-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {match.jobTitle}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(match.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {match.matchScore != null && (
            <span className="rounded-full border border-blue-700/40 bg-blue-900/40 px-2.5 py-1 text-sm font-semibold text-blue-300">
              {match.matchScore}%
            </span>
          )}
          {open ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <DetailedReport
            data={match.result}
            isProcessing={false}
            onRequest={() => {}}
          />
        </div>
      )}
    </Card>
  );
}
