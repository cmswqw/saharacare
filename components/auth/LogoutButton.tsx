"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export function LogoutButton({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const { t } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signoutError } = await supabase.auth.signOut();

    if (signoutError) {
      setError(t("signoutError"));
      setSubmitting(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        size={iconOnly ? "icon" : "default"}
        className={iconOnly ? undefined : "w-full"}
        onClick={logout}
        disabled={submitting}
        aria-label={iconOnly ? t("signOut") : undefined}
      >
        {submitting ? <LoaderCircle className="animate-spin" /> : <LogOut />}
        {iconOnly ? null : submitting ? t("signingOut") : t("signOut")}
      </Button>
      {error ? <p role="alert" className={iconOnly ? "sr-only" : "mt-2 text-sm font-semibold text-red-600"}>{error}</p> : null}
    </div>
  );
}
