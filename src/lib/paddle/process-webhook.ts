import { type EventEntity, EventName, type TransactionCompletedEvent } from "@paddle/paddle-node-sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { creditsForPriceId } from "@/lib/paddle/catalog";

/**
 * Paddle delivers at-least-once and redelivers the same event.eventId on
 * retry, so this must be idempotent. Idempotency comes from the UNIQUE
 * constraint on payments.paddle_event_id: a duplicate insert throws, and we
 * treat that as "already handled" rather than granting credits twice.
 */
export async function processEvent(event: EventEntity) {
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      return handleTransactionCompleted(event);
    default:
      return;
  }
}

async function handleTransactionCompleted(event: TransactionCompletedEvent) {
  const userId = event.data.customData?.user_id;
  if (typeof userId !== "string" || !userId) {
    console.error("transaction.completed missing custom_data.user_id", event.data.id);
    return;
  }

  const priceId = event.data.items[0]?.price?.id;
  const credits = priceId ? creditsForPriceId(priceId) : null;
  if (!priceId || !credits) {
    console.error("transaction.completed unknown price_id", priceId, event.data.id);
    return;
  }

  const amountCents = Number(event.data.details?.totals?.total ?? "0");
  const currencyCode = event.data.currencyCode ?? "USD";

  const supabase = createServiceClient();

  // Idempotency gate: unique on paddle_event_id. A redelivered event hits
  // the conflict below and returns early, never reaching grant_credits.
  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      paddle_event_id: event.eventId,
      paddle_transaction_id: event.data.id,
      paddle_price_id: priceId,
      amount_cents: amountCents,
      currency_code: currencyCode,
      credits_granted: credits,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Unique violation on paddle_event_id — this event was already processed.
      return;
    }
    throw insertError;
  }

  const { error: rpcError } = await supabase.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_reason: "paddle_purchase",
    p_ref_type: "payment",
    p_ref_id: payment.id,
  });

  if (rpcError) throw rpcError;
}
