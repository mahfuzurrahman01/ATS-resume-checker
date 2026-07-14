import { createServiceClient } from "@/lib/supabase/server";

/**
 * Wrappers around the spend_credits() / grant_credits() Postgres functions
 * (migration 0004). These are the ONLY way credits.balance is ever written —
 * each call atomically updates the balance and appends a credit_ledger row.
 * The functions are locked to the service role, so these must run server-side.
 */

export type CreditReason =
  | "signup_bonus"
  | "monthly_topup"
  | "scan"
  | "match"
  | "refund"
  | "purchase"
  | "migration_opening_balance";

export type CreditRefType = "scan" | "match" | "payment" | null;

/** Thrown by spendCredits when the user's balance is too low. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Spends `amount` credits. Throws InsufficientCreditsError if the balance
 * (and the user is not lifetime) is too low. Returns the new balance.
 */
export async function spendCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  refType: CreditRefType,
  refId: string | null
): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc("spend_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_type: refType,
    p_ref_id: refId,
  });
  if (error) {
    if (error.message?.includes("insufficient_credits")) {
      throw new InsufficientCreditsError();
    }
    throw new Error(`spend_credits failed: ${error.message}`);
  }
  return data as number;
}

/** Grants `amount` credits (refund/top-up/purchase). Returns the new balance. */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  refType: CreditRefType,
  refId: string | null
): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_type: refType,
    p_ref_id: refId,
  });
  if (error) {
    throw new Error(`grant_credits failed: ${error.message}`);
  }
  return data as number;
}
