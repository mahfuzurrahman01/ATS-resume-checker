import { createClient } from "@/lib/supabase/server";

/**
 * Read access to `credit_ledger` (migration 0004) for the /settings credit
 * history view. Uses the session-scoped client, not the service role — RLS
 * already allows a user to select their own ledger rows, so no elevated
 * access is needed for a read the user is entitled to.
 */

export interface CreditLedgerEntry {
  id: string;
  delta: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  balance_after: number;
  created_at: string;
}

export async function listCreditLedger(
  userId: string,
  limit = 100
): Promise<CreditLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, delta, reason, ref_type, ref_id, balance_after, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listCreditLedger failed: ${error.message}`);
  return (data as CreditLedgerEntry[]) ?? [];
}
