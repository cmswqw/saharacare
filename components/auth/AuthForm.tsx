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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dashboardPath } from "@/lib/auth-utils";
import { Button } from "@/components/ui/Button";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import type { UserRole } from "@/types";

type AuthMode = "login" | "signup";

function messageForAuthError(error: { code?: string; message: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "The email or password is incorrect. Check both fields and try again.";
    case "email_not_confirmed":
      return "Please confirm your email address before signing in.";
    case "user_already_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "Choose a stronger password with at least 8 characters.";
    case "signup_disabled":
      return "New account registration is currently disabled.";
    case "over_request_rate_limit":
      return "Too many attempts were made. Wait a moment and try again.";
    default:
      return error.message.toLowerCase().includes("fetch")
        ? "SaharaCare could not reach the authentication service. Check your connection and try again."
        : error.message || "Authentication could not be completed. Please try again.";
  }
}

export function AuthForm({
  initialMessage,
  initialRole = "patient",
  mode,
}: {
  initialMessage?: string;
  initialRole?: UserRole;
  mode: AuthMode;
}) {
  const router = useRouter();
  const signup = mode === "signup";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [error, setError] = useState<string | null>(initialMessage ?? null);
  const [success, setSuccess] = useState<string | null>(null);
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
      || (data.role !== "patient" && data.role !== "caregiver")
    ) {
      throw new Error("Your account profile could not be loaded. Please contact the SaharaCare team.");
    }

    return data.role as UserRole;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();

    if (signup && !normalizedName) {
      setError("Enter your full name.");
      return;
    }

    if (!normalizedEmail || !password) {
      setError("Enter both your email address and password.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (signup && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
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
          setError(messageForAuthError(signupError));
          return;
        }

        if (!data.session) {
          setSuccess(
            "Account created. Check your email and follow the confirmation link before signing in.",
          );
          setPassword("");
          return;
        }

        if (!data.user) {
          setError("The account was created, but SaharaCare could not start a session. Please sign in.");
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
        setError(messageForAuthError(loginError));
        return;
      }

      if (!data.user) {
        setError("SaharaCare could not identify the signed-in account. Please try again.");
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
      setError(
        unexpectedError instanceof Error
          ? unexpectedError.message
          : "Authentication could not be completed. Please try again.",
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
            aria-label="Back"
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
              <p className="eyebrow mt-5">{signup ? "Create your account" : "Welcome back"}</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {signup ? "Join SaharaCare" : "Sign in to SaharaCare"}
              </h1>
              <p className="mt-3 text-base text-muted">
                {signup
                  ? "Your role keeps you in the right care experience."
                  : "Use the email and password for your SaharaCare account."}
              </p>
            </div>

            <form className="space-y-5 p-6 md:p-8" onSubmit={handleSubmit} noValidate>
              {signup ? (
                <>
                  <fieldset>
                    <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                      I am joining as
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { value: "patient" as const, label: "Patient", Icon: UserRound },
                        { value: "caregiver" as const, label: "Caregiver", Icon: UsersRound },
                      ]).map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={role === value}
                          onClick={() => setRole(value)}
                          disabled={submitting}
                          className={`flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 px-4 font-extrabold transition-colors ${
                            role === value
                              ? "border-primary bg-blue-50 text-primary dark:bg-blue-950/40"
                              : "border-border bg-card text-muted hover:border-primary/40"
                          }`}
                        >
                          <Icon />
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="mb-2 block font-bold">Full name</span>
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
                <span className="mb-2 block font-bold">Email address</span>
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
                    placeholder="you@example.com"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block font-bold">Password</span>
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
                    placeholder={signup ? "At least 8 characters" : "Your password"}
                  />
                </span>
              </label>

              {error ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div role="status" className="flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800 dark:bg-green-950/30 dark:text-green-200">
                  <CheckCircle2 className="mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              ) : null}

              <Button type="submit" size="large" className="w-full" disabled={submitting || Boolean(success)}>
                {submitting ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
                {submitting
                  ? signup ? "Creating account…" : "Signing in…"
                  : signup ? "Create account" : "Sign in"}
              </Button>

              <p className="text-center font-semibold text-muted">
                {signup ? "Already have an account?" : "New to SaharaCare?"}{" "}
                <Link href={signup ? "/login" : "/role"} className="font-extrabold text-primary hover:underline">
                  {signup ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
