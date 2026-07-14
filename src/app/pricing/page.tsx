import { getCurrentUser } from "@/lib/auth";
import { PricingClient } from "./PricingClient";

export const metadata = {
  title: "Pricing - ATS Resume Checker",
};

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Simple, credit-based pricing
        </h1>
        <p className="text-gray-300">
          Every account starts with 10 free credits. A scan costs 1 credit, a
          job match costs 2. Buy more whenever you need them.
        </p>
      </div>

      <PricingClient userId={user?.id ?? null} userEmail={user?.email ?? null} />
    </div>
  );
}
