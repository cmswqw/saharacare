import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getAuthContext } from "@/lib/auth";
import { dashboardPath } from "@/lib/auth-utils";

const errorMessages: Record<string, string> = {
  confirmation: "The email confirmation link is invalid or has expired. Request a new signup email or try signing in.",
  profile: "Your authentication succeeded, but your SaharaCare profile is missing. Sign out and contact the project administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const context = await getAuthContext();

  if (context.profile) {
    redirect(dashboardPath(context.profile.role));
  }

  const { error } = await searchParams;

  return (
    <AuthForm
      mode="login"
      initialMessage={error ? errorMessages[error] ?? "Authentication could not be completed." : undefined}
    />
  );
}
