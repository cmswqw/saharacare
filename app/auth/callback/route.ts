import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { dashboardPath } from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing confirmation parameters") };

  if (error) {
    redirect("/login?error=confirmation");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?error=confirmation");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError
    || !profile
    || (profile.role !== "patient" && profile.role !== "caregiver" && profile.role !== "doctor")
  ) {
    redirect("/login?error=profile");
  }

  redirect(dashboardPath(profile.role));
}
