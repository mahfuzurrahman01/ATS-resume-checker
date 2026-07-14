"use client";

import { Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface ProgressStage {
  id: string;
  label: string;
}

interface AnalysisProgressProps {
  stages: ProgressStage[];
  completed: Set<string>;
  current: string | null;
}

/**
 * Real stage progress — driven by actual server events (see
 * src/lib/streaming.ts / ndjson-client.ts), not a fabricated percentage.
 * A stage only shows a checkmark once the server has genuinely finished it.
 */
export function AnalysisProgress({ stages, completed, current }: AnalysisProgressProps) {
  return (
    <Card className="bg-gray-900/30 border border-gray-700/40">
      <CardContent className="p-5 space-y-3">
        {stages.map((stage) => {
          const isDone = completed.has(stage.id);
          const isCurrent = current === stage.id;
          return (
            <div key={stage.id} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isDone
                    ? "bg-green-500 border-green-500"
                    : isCurrent
                    ? "border-purple-400"
                    : "border-gray-700"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4 text-white" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                ) : null}
              </div>
              <span
                className={`text-sm ${
                  isDone
                    ? "text-gray-300"
                    : isCurrent
                    ? "text-white font-medium"
                    : "text-gray-500"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
