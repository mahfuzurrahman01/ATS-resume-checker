"use client";

import React, { useState } from "react";
import {
  Crown,
  Target,
  ScanText,
  Wand2,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResumeData } from "@/lib/gemini-service";

interface DetailedReportProps {
  data: ResumeData;
  isProcessing: boolean;
  onRequest: (jobDescription?: string) => void;
}

export function DetailedReport({
  data,
  isProcessing,
  onRequest,
}: DetailedReportProps) {
  const [jd, setJd] = useState("");

  const hasDetailed = !!(
    data.jd_match ||
    data.parse_preview ||
    (data.bullet_rewrites && data.bullet_rewrites.length > 0)
  );

  // ---- Unlock CTA (before purchase) --------------------------------------
  if (!hasDetailed) {
    return (
      <Card className="border-2 border-dashed border-purple-500/40 bg-gray-900/30 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2">
            <Crown className="h-6 w-6 text-yellow-400" />
            <CardTitle className="text-2xl text-white">
              Unlock the Detailed Report
            </CardTitle>
          </div>
          <CardDescription className="text-gray-300">
            Job-description match, ATS parse preview, and AI-rewritten bullet
            points — everything you need to tailor this resume.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Feature icon={<Target className="h-5 w-5 text-blue-400" />} title="JD Match" desc="Score this resume against a specific job" />
            <Feature icon={<ScanText className="h-5 w-5 text-green-400" />} title="Parse Preview" desc="See exactly what an ATS reads" />
            <Feature icon={<Wand2 className="h-5 w-5 text-purple-400" />} title="Bullet Rewriter" desc="Weak lines rewritten & quantified" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">
              Paste the job description{" "}
              <span className="text-gray-500">(optional, boosts accuracy)</span>
            </label>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the job posting here to get a match score and missing keywords…"
              rows={5}
              disabled={isProcessing}
              className="w-full rounded-xl bg-gray-800/60 border border-gray-700/50 p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={() => onRequest(jd.trim() || undefined)}
              disabled={isProcessing}
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              {isProcessing
                ? "Analyzing…"
                : "Unlock Detailed Report (1 credit)"}
            </Button>
            <p className="text-xs text-gray-500">
              Lifetime members: unlimited detailed reports.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Detailed results (after purchase) ---------------------------------
  return (
    <div className="space-y-6">
      {data.jd_match && <JdMatch match={data.jd_match} />}
      {data.parse_preview && <ParsePreview text={data.parse_preview} />}
      {data.bullet_rewrites && data.bullet_rewrites.length > 0 && (
        <BulletRewrites items={data.bullet_rewrites} />
      )}
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-3 text-left">
      <div className="flex items-center space-x-2 mb-1">
        {icon}
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function JdMatch({ match }: { match: NonNullable<ResumeData["jd_match"]> }) {
  return (
    <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Target className="h-6 w-6 text-blue-400" />
          <span>Job Description Match</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center space-x-4">
          <span className={`text-4xl font-bold ${scoreColor(match.match_score)}`}>
            {match.match_score}%
          </span>
          <p className="text-sm text-gray-300 flex-1">{match.summary}</p>
        </div>

        {match.title_alignment && (
          <p className="text-sm text-gray-300">
            <span className="text-gray-400">Title fit: </span>
            {match.title_alignment}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="flex items-center space-x-1 text-sm font-semibold text-green-400 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span>Matched ({match.matched_keywords?.length || 0})</span>
            </h4>
            <ChipList items={match.matched_keywords} tone="green" empty="No matches found." />
          </div>
          <div>
            <h4 className="flex items-center space-x-1 text-sm font-semibold text-yellow-400 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Missing ({match.missing_keywords?.length || 0})</span>
            </h4>
            <ChipList items={match.missing_keywords} tone="yellow" empty="Nothing critical missing." />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChipList({
  items,
  tone,
  empty,
}: {
  items?: string[];
  tone: "green" | "yellow";
  empty: string;
}) {
  const cls =
    tone === "green"
      ? "bg-green-900/50 text-green-300 border-green-700/30"
      : "bg-yellow-900/50 text-yellow-300 border-yellow-700/30";
  if (!items || items.length === 0)
    return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((k, i) => (
        <span key={i} className={`px-2 py-1 text-xs rounded-full border ${cls}`}>
          {k}
        </span>
      ))}
    </div>
  );
}

function ParsePreview({ text }: { text: string }) {
  return (
    <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <ScanText className="h-6 w-6 text-green-400" />
          <span>ATS Parse Preview</span>
        </CardTitle>
        <CardDescription className="text-gray-300">
          This is the plain text an ATS is likely to extract from your resume.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-950/60 border border-gray-700/40 p-4 text-xs text-gray-300 font-mono leading-relaxed">
          {text}
        </pre>
      </CardContent>
    </Card>
  );
}

function BulletRewrites({
  items,
}: {
  items: NonNullable<ResumeData["bullet_rewrites"]>;
}) {
  return (
    <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Wand2 className="h-6 w-6 text-purple-400" />
          <span>AI Bullet Rewrites</span>
        </CardTitle>
        <CardDescription className="text-gray-300">
          Stronger, quantified versions of your weakest bullet points.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-4 space-y-2"
          >
            <p className="text-sm text-gray-400 line-through">{item.original}</p>
            <div className="flex items-start space-x-2">
              <ArrowRight className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-white font-medium">{item.improved}</p>
            </div>
            {item.reason && (
              <p className="text-xs text-gray-500 pl-6">{item.reason}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
