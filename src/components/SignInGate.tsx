"use client";

import { useState } from "react";
import { LogIn, Sparkles, ShieldCheck, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Shown on the homepage to logged-out users in place of the uploader. */
export function SignInGate() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="rounded-3xl bg-gray-900/40 backdrop-blur-xl border border-gray-700/40 shadow-2xl p-8 space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            Sign in to check your resume
          </h2>
          <p className="text-gray-300 text-sm">
            Create a free account to scan resumes, save your history, and unlock
            detailed AI reports.
          </p>
        </div>

        <Button
          onClick={signIn}
          disabled={loading}
          size="lg"
          className="w-full bg-white text-gray-900 hover:bg-gray-100"
        >
          <LogIn className="h-5 w-5 mr-2" />
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <div className="flex items-center justify-center gap-5 text-xs text-gray-400 pt-2">
          <span className="inline-flex items-center gap-1">
            <Gift className="h-4 w-4 text-purple-400" />
            10 free credits
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-green-400" />
            Private &amp; secure
          </span>
        </div>
      </div>
    </div>
  );
}
