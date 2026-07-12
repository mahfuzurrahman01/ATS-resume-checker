"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface AuthButtonProps {
  /** Signed-in user's display info, resolved on the server. Null if logged out. */
  user: { email: string; name?: string; avatarUrl?: string } | null;
}

export function AuthButton({ user }: AuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (!user) {
    return (
      <Button
        onClick={signIn}
        disabled={loading}
        size="sm"
        className="bg-white text-gray-900 hover:bg-gray-100"
      >
        <LogIn className="h-4 w-4 mr-2" />
        {loading ? "Redirecting…" : "Sign in"}
      </Button>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={user.name || user.email}
          className="h-8 w-8 rounded-full border border-gray-600"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-semibold text-white">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
      )}
      <form action="/auth/signout" method="post">
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="bg-gray-900 text-gray-200 border-gray-700 hover:bg-gray-800"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </form>
    </div>
  );
}
