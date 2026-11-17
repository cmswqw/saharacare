"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";

export function RetryDataButton() {
  const router = useRouter();
  const { t } = useApp();
  const [pending, startTransition] = useTransition();
  return <Button type="button" className="mt-4 min-h-14" disabled={pending} aria-busy={pending}
    onClick={() => startTransition(() => router.refresh())}>{t(pending ? "loading" : "tryAgain")}</Button>;
}
