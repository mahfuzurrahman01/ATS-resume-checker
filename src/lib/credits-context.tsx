"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export interface Credits {
  balance: number;
  isLifetime: boolean;
}

interface CreditsContextValue {
  credits: Credits;
  loggedIn: boolean;
  /** Apply a fresh credits value (e.g. from an API response). */
  setCredits: (c: Credits) => void;
  /** Re-fetch the canonical balance from the server. */
  refresh: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({
  initial,
  loggedIn,
  children,
}: {
  initial: Credits;
  loggedIn: boolean;
  children: React.ReactNode;
}) {
  const [credits, setCredits] = useState<Credits>(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.credits) setCredits(data.credits);
    } catch {
      // best-effort; ignore
    }
  }, []);

  return (
    <CreditsContext.Provider
      value={{ credits, loggedIn, setCredits, refresh }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

/** Returns the credits context, or null if used outside the provider. */
export function useCredits(): CreditsContextValue | null {
  return useContext(CreditsContext);
}
