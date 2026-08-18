"use client";

import { ProgressRing } from "@/components/ui/ProgressRing";
import { useApp } from "@/components/providers/AppProvider";

export function AdherenceRing({ value, label }: { value: number | null; label?: string }) {
  const { t } = useApp();
  return <ProgressRing value={value} label={label ?? t("weeklyAdherence")} />;
}
