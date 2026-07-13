import React from "react";
import { Coins } from "lucide-react";

interface CreditBadgeProps {
  cost: number;
  className?: string;
}

/** Small chip showing how many credits an action will cost. */
export function CreditBadge({ cost, className = "" }: CreditBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-purple-900/40 border border-purple-500/40 px-2.5 py-1 text-xs font-medium text-purple-200 ${className}`}
    >
      <Coins className="h-3.5 w-3.5" />
      {cost} credit{cost === 1 ? "" : "s"}
    </span>
  );
}
