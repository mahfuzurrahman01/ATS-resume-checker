"use client";

import { useEffect, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/paddle/catalog";
import { createClient } from "@/lib/supabase/client";
import { useCredits } from "@/lib/credits-context";

const PLANS: {
  id: CreditPackId;
  name: string;
  price: string;
  credits: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: `$${CREDIT_PACKS.starter.priceUsd}`,
    credits: `${CREDIT_PACKS.starter.credits} credits`,
    features: ["20 scans or 10 job matches", "Credits never expire"],
  },
  {
    id: "jobHunt",
    name: "Job Hunt",
    price: `$${CREDIT_PACKS.jobHunt.priceUsd}`,
    credits: `${CREDIT_PACKS.jobHunt.credits} credits`,
    features: ["60 scans or 30 job matches", "Credits never expire", "Best value per credit"],
    highlighted: true,
  },
];

export function PricingClient({
  userId,
  userEmail,
}: {
  userId: string | null;
  userEmail: string | null;
}) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const creditsCtx = useCredits();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || !process.env.NEXT_PUBLIC_PADDLE_ENV) {
      return;
    }
    initializePaddle({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production",
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          setLoadingId(null);
          // The webhook grants credits asynchronously and can lag slightly
          // behind this client-side event, so retry a couple of times
          // rather than trusting the first refresh to see the new balance.
          creditsCtx?.refresh();
          setTimeout(() => creditsCtx?.refresh(), 2000);
          setTimeout(() => creditsCtx?.refresh(), 5000);
        }
        if (event.name === "checkout.closed") setLoadingId(null);
      },
    }).then((p) => p && setPaddle(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buy(packId: CreditPackId) {
    if (!paddle || !userId) return;
    setLoadingId(packId);
    paddle.Checkout.open({
      items: [{ priceId: CREDIT_PACKS[packId].priceId, quantity: 1 }],
      ...(userEmail && { customer: { email: userEmail } }),
      customData: { user_id: userId },
      settings: { variant: "one-page" },
    });
  }

  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
      {PLANS.map((plan) => (
        <Card
          key={plan.name}
          className={`bg-gray-900/20 border ${
            plan.highlighted ? "border-purple-500/60 shadow-2xl" : "border-gray-700/30"
          }`}
        >
          <CardHeader>
            <CardTitle className="text-white">{plan.name}</CardTitle>
            <CardDescription className="text-gray-300">
              <span className="text-3xl font-bold text-white">{plan.price}</span>
            </CardDescription>
            <p className="text-sm text-purple-300">{plan.credits}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {userId ? (
              <Button
                onClick={() => buy(plan.id)}
                disabled={!paddle || loadingId === plan.id}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
              >
                {loadingId === plan.id ? "Opening checkout…" : "Buy credits"}
              </Button>
            ) : (
              <Button
                onClick={signIn}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
              >
                Sign in to buy
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
