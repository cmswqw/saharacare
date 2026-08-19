"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  UsersRound,
  Stethoscope,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dashboardPath } from "@/lib/auth-utils";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useApp } from "@/components/providers/AppProvider";
import type { TranslationKey } from "@/lib/i18n";
import type { UserRole } from "@/types";

type AuthMode = "login" | "signup";

function messageKeyForAuthError(error: { code?: string; message: string }): TranslationKey {
  switch (error.code) {
    case "invalid_credentials":
      return "authInvalidCredentials";
    case "email_not_confirmed":
      return "authEmailNotConfirmed";
    case "user_already_exists":
      return "authUserExists";
    case "weak_password":
      return "authWeakPassword";
    case "signup_disabled":
      return "authSignupDisabled";
    case "over_request_rate_limit":
      return "authRateLimit";
    default:
      return error.message.toLowerCase().includes("fetch")
        ? "authConnectionError"
        : "authGenericError";
  }
}

export function AuthForm({
  initialMessageKey,
  initialRole = "patient",
  mode,
}: {
  initialMessageKey?: TranslationKey;
  initialRole?: UserRole;
  mode: AuthMode;
}) {
  const router = useRouter();
  const { t } = useApp();
  const signup = mode === "signup";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(initialMessageKey ?? null);
  const [successKey, setSuccessKey] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadStoredRole(userId: string) {
    const supabase = createClient();
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (
      profileError
      || !data
      || (data.role !== "patient" && data.role !== "caregiver" && data.role !== "doctor" && data.role !== "admin")
    ) {
      throw new Error("auth_profile_unavailable");
    }

    return data.role as UserRole;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setErrorKey(null);
    setSuccessKey(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();

    if (signup && !normalizedName) {
      setErrorKey("authEnterName");
      return;
    }

    if (!normalizedEmail || !password) {
      setErrorKey("authEnterEmailPassword");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setErrorKey("authValidEmail");
      return;
    }

    if (signup && password.length < 8) {
      setErrorKey("authPasswordLength");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      if (signup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: normalizedName,
              role,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signupError) {
          setErrorKey(messageKeyForAuthError(signupError));
          return;
        }

        if (!data.session) {
          setSuccessKey("authAccountCreated");
          setPassword("");
          return;
        }

        if (!data.user) {
          setErrorKey("authSessionMissing");
          return;
        }

        const storedRole = await loadStoredRole(data.user.id);
        router.replace(dashboardPath(storedRole));
        router.refresh();
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (loginError) {
        setErrorKey(messageKeyForAuthError(loginError));
        return;
      }

      if (!data.user) {
        setErrorKey("authUserMissing");
        return;
      }

      try {
        const storedRole = await loadStoredRole(data.user.id);
        router.replace(dashboardPath(storedRole));
        router.refresh();
      } catch (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }
    } catch (unexpectedError) {
      setErrorKey(
        unexpectedError instanceof Error
          && unexpectedError.message === "auth_profile_unavailable"
          ? "authProfileUnavailable"
          : "authGenericError",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-[48px_1fr] items-center gap-3 sm:grid-cols-[48px_1fr_auto]">
          <Link
            href={signup ? "/role" : "/"}
            className="grid h-12 w-12 place-items-center rounded-2xl border bg-card"
            aria-label={t("back")}
          >
            <ArrowLeft />
          </Link>
          <Link href="/" className="flex items-center justify-self-center gap-2 font-extrabold">
            <HeartPulse className="text-primary" />
            SaharaCare
          </Link>
          <div className="col-span-2 justify-self-center sm:col-span-1 sm:justify-self-end">
            <LanguageToggle />
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <div className="surface overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-7 text-center dark:from-blue-950/50 dark:to-slate-800">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-primary shadow-soft dark:bg-slate-900">
                <LockKeyhole className="h-8 w-8" />
              </span>
              <p className="eyebrow mt-5">{t(signup ? "createYourAccount" : "welcomeBack")}</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t(signup ? "joinSaharaCare" : "signInToSaharaCare")}
              </h1>
              <p className="mt-3 text-base text-muted">
                {t(signup ? "signupRoleHelp" : "signinHelp")}
              </p>
            </div>

            <form className="space-y-5 p-6 md:p-8" onSubmit={handleSubmit} noValidate>
              {signup ? (
                <>
                  <fieldset>
                    <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                      {t("joiningAs")}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        { value: "patient" as const, labelKey: "patient" as const, Icon: UserRound },
                        { value: "caregiver" as const, labelKey: "caregiver" as const, Icon: UsersRound },
                        { value: "doctor" as const, labelKey: "doctor" as const, Icon: Stethoscope },
                      ]).map(({ value, labelKey, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={role === value}
                          onClick={() => setRole(value)}
                          disabled={submitting}
                          className={`flex h-20 min-h-20 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-center font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
                            role === value
                              ? "border-primary bg-blue-50 text-primary dark:bg-blue-950/40"
                              : "border-border bg-card text-muted hover:border-primary/40"
                          }`}
                        >
                          <Icon />
                          {t(labelKey)}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="mb-2 block font-bold">{t("fullName")}</span>
                    <span className="relative block">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        name="fullName"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        disabled={submitting}
                        className="min-h-14 w-full rounded-2xl border-2 bg-card py-3 pl-12 pr-4 text-base font-semibold"
                        placeholder="Maya Sharma"
                      />
                    </span>
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="mb-2 block font-bold">{t("emailAddress")}</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={submitting}
                    className="min-h-14 w-full rounded-2xl border-2 bg-card py-3 pl-12 pr-4 text-base font-semibold"
                  placeholder={t("emailPlaceholder")}
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block font-bold">{t("password")}</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    type="password"
                    name="password"
                    autoComplete={signup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    className="min-h-14 w-full rounded-2xl border-2 bg-card py-3 pl-12 pr-4 text-base font-semibold"
                  placeholder={t(signup ? "signupPasswordPlaceholder" : "signinPasswordPlaceholder")}
                  />
                </span>
              </label>

              {errorKey ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-200">
                  {t(errorKey)}
                </div>
              ) : null}

              {successKey ? (
                <div role="status" className="flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800 dark:bg-green-950/30 dark:text-green-200">
                  <CheckCircle2 className="mt-0.5 shrink-0" />
                  <span>{t(successKey)}</span>
                </div>
              ) : null}

              <Button type="submit" size="large" className="w-full" disabled={submitting || Boolean(successKey)}>
                {submitting ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
                {submitting
                  ? t(signup ? "creatingAccount" : "signingIn")
                  : t(signup ? "createAccount" : "signIn")}
              </Button>

              <p className="text-center font-semibold text-muted">
                {t(signup ? "alreadyHaveAccount" : "newToSaharaCare")}{" "}
                <Link href={signup ? "/login" : "/role"} className="font-extrabold text-primary hover:underline">
                  {t(signup ? "signIn" : "createAccount")}
                </Link>
              </p>
            </form>
          </div>
        </div>
        <footer className="mt-8 text-center text-sm font-medium text-muted">
          {t("copyright", { year: new Date().getFullYear() })}
        </footer>
      </div>
    </main>
  );
}
