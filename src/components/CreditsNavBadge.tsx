"use client";

import { Coins, Crown } from "lucide-react";
import { useCredits } from "@/lib/credits-context";

/** Live credit balance in the navbar; updates instantly after each action. */
export function CreditsNavBadge() {
  const ctx = useCredits();
  if (!ctx || !ctx.loggedIn) return null;

  const { balance, isLifetime } = ctx.credits;
  return (
    <span className="inline-flex items-center space-x-1.5 rounded-full bg-gray-900/60 border border-gray-700/40 px-3 py-1.5 text-sm text-gray-200">
      {isLifetime ? (
        <>
          <Crown className="h-4 w-4 text-yellow-400" />
          <span>Lifetime</span>
        </>
      ) : (
        <>
          <Coins className="h-4 w-4 text-purple-400" />
          <span>
            {balance} credit{balance === 1 ? "" : "s"}
          </span>
        </>
      )}
    </span>
  );
}
