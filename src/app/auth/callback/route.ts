import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAuthCallbackRateLimit } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/** OAuth redirect target — exchanges the auth code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // IP-based (not user_id — no session exists yet at this point), to slow
  // signup abuse without punishing one legitimate user for another's traffic.
  const rateLimit = await checkAuthCallbackRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    return NextResponse.redirect(`${origin}/?auth_error=rate_limited`);
  }

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
