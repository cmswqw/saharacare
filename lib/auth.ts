import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { dashboardPath } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";
import type { AuthProfile, UserRole } from "@/types";

type AuthContext = {
  profile: AuthProfile | null;
  signedIn: boolean;
};

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { profile: null, signedIn: false };
  }

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError
    || !data
    || (data.role !== "patient" && data.role !== "caregiver" && data.role !== "doctor")
  ) {
    return { profile: null, signedIn: true };
  }

  return {
    signedIn: true,
    profile: {
      id: data.id,
      full_name: data.full_name,
      role: data.role,
      avatar_url: data.avatar_url,
      email: user.email ?? null,
    },
  };
});

export async function getCurrentProfile() {
  return (await getAuthContext()).profile;
}

export async function requireProfile() {
  const context = await getAuthContext();

  if (!context.signedIn) {
    redirect("/login");
  }

  if (!context.profile) {
    redirect("/login?error=profile");
  }

  return context.profile;
}

export async function requireRole(expectedRole: UserRole) {
  const profile = await requireProfile();

  if (profile.role !== expectedRole) {
    redirect(dashboardPath(profile.role));
  }

  return profile;
}
