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
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { DetailedReport } from "@/components/DetailedReport";
import type { ResumeData } from "@/lib/gemini-service";
import type { ScanRecord } from "@/lib/scans";
import type { CurrentUser, UserCredits } from "@/lib/auth";
import { looksLikeJobDescription } from "@/lib/utils";

interface ProfileClientProps {
  user: CurrentUser;
  credits: UserCredits;
  scans: ScanRecord[];
}

export function ProfileClient({ user, credits, scans }: ProfileClientProps) {
  const [selected, setSelected] = useState<ScanRecord | null>(null);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshDetailed, setFreshDetailed] = useState<ResumeData | null>(null);

  const openScan = (scan: ScanRecord) => {
    setSelected(scan);
    setFreshDetailed(null);
    setError(null);
    setJd("");
  };

  const runDetailed = async () => {
    if (!selected) return;
    const trimmed = jd.trim();
    if (trimmed) {
      const check = looksLikeJobDescription(trimmed);
      if (!check.ok) {
        setError(check.reason ?? "Please paste a valid job description.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${selected.id}/detailed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: trimmed || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate report");
      setFreshDetailed(data.data as ResumeData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ---- Detail view for a selected scan -----------------------------------
  if (selected) {
    const detailedData = freshDetailed ?? selected.result;
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

        <ResultsDisplay data={selected.result} onReset={() => setSelected(null)} />

        {/* Re-run detailed against a new job description */}
        <Card className="mt-6 border-2 border-dashed border-purple-500/40 bg-gray-900/30 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <Target className="h-5 w-5 text-blue-400" />
              <span>Match this resume to a new job</span>
            </CardTitle>
            <CardDescription className="text-gray-300">
              Paste a job description to get a fresh match score, missing
              keywords, and bullet rewrites. Costs 2 credits
              {credits.isLifetime ? " (free for lifetime members)" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the new job description here…"
              rows={5}
              disabled={loading}
              className="w-full rounded-xl bg-gray-800/60 border border-gray-700/50 p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button
              onClick={runDetailed}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Analyzing…" : "Generate Detailed Report (2 credits)"}
            </Button>
          </CardContent>
        </Card>

        {/* Detailed sections — freshly generated or stored on the scan */}
        {(freshDetailed ||
          detailedData.jd_match ||
          detailedData.parse_preview ||
          (detailedData.bullet_rewrites?.length ?? 0) > 0) && (
          <div className="mt-6">
            <DetailedReport
              data={detailedData}
              isProcessing={loading}
              onRequest={() => {}}
            />
          </div>
        )}
      </div>
    );
  }

  // ---- List view ----------------------------------------------------------
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
            {credits.isLifetime ? (
              <>
                <Crown className="h-4 w-4 text-yellow-400" />
                <span>Lifetime</span>
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 text-purple-400" />
                <span>{credits.balance} credits</span>
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

      <h2 className="text-lg font-semibold text-white mb-4">
        My scanned resumes
      </h2>

      {scans.length === 0 ? (
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-10 text-center">
            <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-300 mb-4">
              You haven&apos;t scanned any resumes yet.
            </p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                Scan your first resume
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => (
            <button
              key={scan.id}
              onClick={() => openScan(scan)}
              className="w-full text-left"
            >
              <Card className="bg-gray-900/20 border border-gray-700/30 hover:border-purple-500/40 hover:bg-gray-900/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {scan.file_name || "Resume.pdf"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(scan.created_at).toLocaleString()}
                        {scan.is_detailed && " · Detailed"}
                        {scan.jd_provided && " · JD match"}
                      </p>
                    </div>
                  </div>
                  <ScoreBadge score={scan.score} />
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
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
