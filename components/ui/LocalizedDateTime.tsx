"use client";

import { useApp } from "@/components/providers/AppProvider";

export function LocalizedDateTime({
  value,
  includeTime = false,
}: {
  value: string;
  includeTime?: boolean;
}) {
  const { language } = useApp();
  const formatter = new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "long",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  });

  return <>{formatter.format(new Date(value))}</>;
}
