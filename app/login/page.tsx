import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getAuthContext } from "@/lib/auth";
import { dashboardPath } from "@/lib/auth-utils";
import type { TranslationKey } from "@/lib/i18n";

const errorMessages: Record<string, TranslationKey> = {
  confirmation: "authConfirmationError",
  profile: "authProfileError",
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
      initialMessageKey={error ? errorMessages[error] ?? "authCouldNotComplete" : undefined}
    />
  );
}
