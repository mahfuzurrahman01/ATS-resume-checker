import React from "react";
import { bandFor, type Band } from "@/lib/analysis/score";

const BAND_LABEL: Record<Band, string> = {
  critical: "Critical",
  "needs-work": "Needs Work",
  good: "Good",
  excellent: "Excellent",
};

const BAND_CLASS: Record<Band, string> = {
  critical: "bg-red-900/50 text-red-300 border-red-700/40",
  "needs-work": "bg-yellow-900/50 text-yellow-300 border-yellow-700/40",
  good: "bg-blue-900/50 text-blue-300 border-blue-700/40",
  excellent: "bg-green-900/50 text-green-300 border-green-700/40",
};

interface ScoreBadgeProps {
  score: number | null;
  className?: string;
}

/** Colored score/band badge, e.g. "74 · Good". Null score renders nothing. */
export function ScoreBadge({ score, className = "" }: ScoreBadgeProps) {
  if (score == null) return null;
  const band = bandFor(score);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${BAND_CLASS[band]} ${className}`}
    >
      {score} · {BAND_LABEL[band]}
    </span>
  );
}
