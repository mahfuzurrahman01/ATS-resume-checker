import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Crown, FileText } from "lucide-react";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { listCreditLedger } from "@/lib/db/credit-ledger";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteAccountClient } from "./DeleteAccountClient";

export const metadata = {
  title: "Settings",
};

const REASON_LABEL: Record<string, string> = {
  signup_bonus: "Signup bonus",
  monthly_topup: "Monthly free top-up",
  scan: "Resume scan",
  match: "Job match",
  refund: "Refund",
  purchase: "Credit purchase",
  migration_opening_balance: "Opening balance",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [credits, ledger] = await Promise.all([
    getUserCredits(user.id),
    listCreditLedger(user.id),
  ]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-white">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {user.name && <p className="text-sm text-gray-300">{user.name}</p>}
          <p className="text-sm text-gray-400">{user.email}</p>
          <div className="flex items-center gap-2 pt-2">
            {credits.isLifetime ? (
              <>
                <Crown className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-gray-200">Lifetime credits</span>
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-200">
                  {credits.balance} credit{credits.balance === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-white">Credit History</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-gray-400">No credit activity yet.</p>
          ) : (
            <div className="space-y-2">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-gray-800/40 border border-gray-700/40 p-3"
                >
                  <div>
                    <p className="text-sm text-white">
                      {REASON_LABEL[entry.reason] ?? entry.reason}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        entry.delta >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {entry.delta >= 0 ? "+" : ""}
                      {entry.delta}
                    </p>
                    <p className="text-xs text-gray-500">
                      balance: {entry.balance_after}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-white">Your Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-400">
            To delete an individual resume (and its scans and job matches),
            go to My Resumes and use the menu on the resume you want to
            remove.
          </p>
          <Link href="/resumes">
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-900/40 border-gray-700/40 text-gray-200 hover:bg-gray-800/40"
            >
              <FileText className="h-4 w-4 mr-2" />
              Go to My Resumes
            </Button>
          </Link>
        </CardContent>
      </Card>

      <DeleteAccountClient email={user.email} />
    </div>
  );
}
