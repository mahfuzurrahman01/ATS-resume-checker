"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountClient({ email }: { email: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typedEmail.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    if (!matches) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typedEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete your account.");
        setBusy(false);
        return;
      }

      // The account is gone server-side; clear the local session too.
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Card className="bg-red-950/20 border border-red-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="h-5 w-5" />
          Delete my account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-400">
          Permanently deletes every resume file, all scans and job matches,
          and your account itself. This cannot be undone.
        </p>

        {!confirming ? (
          <Button
            variant="outline"
            onClick={() => setConfirming(true)}
            className="border-red-800/50 bg-red-950/30 text-red-300 hover:bg-red-950/50"
          >
            Delete my account
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Type <span className="font-mono text-white">{email}</span> to
              confirm.
            </p>
            <input
              value={typedEmail}
              onChange={(e) => {
                setTypedEmail(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy}
              placeholder={email}
              className="w-full rounded-xl bg-gray-800/60 border border-red-800/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setTypedEmail("");
                  setError(null);
                }}
                className="bg-gray-800 border-gray-700/50 text-gray-200"
              >
                Cancel
              </Button>
              <Button
                disabled={!matches || busy}
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Permanently delete my account"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
