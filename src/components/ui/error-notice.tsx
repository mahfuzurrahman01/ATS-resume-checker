import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** Consistent, readable error card used across the app. */
export function ErrorNotice({ message, onRetry, className = "" }: ErrorNoticeProps) {
  return (
    <div
      className={`rounded-2xl border border-red-800/50 bg-red-950/40 p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-900/60">
          <AlertTriangle className="h-4 w-4 text-red-300" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-red-200">Something went wrong</p>
          <p className="mt-1 text-sm text-red-300/90 leading-relaxed">
            {message}
          </p>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="mt-3 border-red-700/50 bg-red-900/30 text-red-200 hover:bg-red-900/50"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
