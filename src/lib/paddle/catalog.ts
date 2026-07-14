/**
 * Single source of truth for credit-pack Paddle price IDs. Credits are
 * looked up here rather than trusted from webhook payload custom_data, since
 * the transaction.completed event's nested price object isn't guaranteed to
 * include it.
 */
export const CREDIT_PACKS = {
  starter: {
    name: "Starter Pack",
    priceId: "pri_01kxfsxe178es47qkag40mpkx3",
    credits: 20,
    priceUsd: 5,
  },
  jobHunt: {
    name: "Job Hunt Pack",
    priceId: "pri_01kxfsxf33jb3g8a5kfzx1tw2a",
    credits: 60,
    priceUsd: 12,
  },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function creditsForPriceId(priceId: string): number | null {
  const pack = Object.values(CREDIT_PACKS).find((p) => p.priceId === priceId);
  return pack ? pack.credits : null;
}
