"use client";

import { createContext, useContext } from "react";
import type { AuthProfile } from "@/types";

const CurrentUserContext = createContext<AuthProfile | null>(null);

export function CurrentUserProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: AuthProfile;
}) {
  return (
    <CurrentUserContext.Provider value={profile}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const profile = useContext(CurrentUserContext);

  if (!profile) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  }

  return profile;
}
