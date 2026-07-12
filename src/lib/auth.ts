import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface UserCredits {
  balance: number;
  isLifetime: boolean;
}

/** True when Supabase env vars are configured. */
export function isAuthConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Resolves the signed-in user from cookies, or null. Safe before setup. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.full_name,
      avatarUrl: user.user_metadata?.avatar_url,
    };
  } catch {
    return null;
  }
}

/** Reads the user's credit balance / lifetime flag. */
export async function getUserCredits(
  userId: string
): Promise<UserCredits> {
  if (!isAuthConfigured()) return { balance: 0, isLifetime: false };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("credits")
      .select("balance, is_lifetime")
      .eq("user_id", userId)
      .single();
    return {
      balance: data?.balance ?? 0,
      isLifetime: data?.is_lifetime ?? false,
    };
  } catch {
    return { balance: 0, isLifetime: false };
  }
}
