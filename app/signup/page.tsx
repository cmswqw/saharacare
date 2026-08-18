import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getAuthContext } from "@/lib/auth";
import { dashboardPath } from "@/lib/auth-utils";
import type { UserRole } from "@/types";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const context = await getAuthContext();

  if (context.profile) {
    redirect(dashboardPath(context.profile.role));
  }

  const params = await searchParams;
  const role: UserRole = params.role === "caregiver"
    ? "caregiver"
    : params.role === "doctor"
      ? "doctor"
      : "patient";

  return <AuthForm mode="signup" initialRole={role} />;
}
