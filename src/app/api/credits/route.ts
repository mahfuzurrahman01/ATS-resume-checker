import { NextResponse } from "next/server";
import { getCurrentUser, getUserCredits } from "@/lib/auth";

/** Returns the signed-in user's current credit balance. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const credits = await getUserCredits(user.id);
  return NextResponse.json({ credits });
}
