import { NextResponse } from "next/server";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
import { checkGeneralRateLimit } from "@/lib/rate-limit";

/** Returns the signed-in user's current credit balance. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rateLimit = await checkGeneralRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const credits = await getUserCredits(user.id);
  return NextResponse.json({ credits });
}
