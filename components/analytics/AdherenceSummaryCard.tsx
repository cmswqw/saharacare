"use client";

import { Check, Clock3, TriangleAlert } from "lucide-react";
import { AdherenceRing } from "@/components/caregiver/AdherenceRing";
import { Card } from "@/components/ui/Card";
import type { AdherenceSummary } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

export function AdherenceSummaryCard({ summary }: { summary: AdherenceSummary }) {
  const { t } = useApp();
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <AdherenceRing value={summary.percentage} />
        <div className="flex-1">
          <p className="eyebrow">{t("lastSevenDays")}</p>
          <h2 className="mt-1 text-2xl font-extrabold">{t("weeklyAdherence")}</h2>
          <p className="mt-3 text-lg font-bold">
            {summary.eligible > 0
              ? t("eligibleDosesTaken", { taken: summary.taken, eligible: summary.eligible })
              : t("noDosesInWindow")}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <p className="flex items-center gap-2 rounded-2xl bg-green-50 p-3 font-bold text-green-800 dark:bg-green-950/30 dark:text-green-100">
              <Check />{t("countTaken", { count: summary.taken })}
            </p>
            <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Clock3 />{t("countLate", { count: summary.late })}
            </p>
            <p className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 font-bold text-red-800 dark:bg-red-950/30 dark:text-red-100">
              <TriangleAlert />{t("countMissed", { count: summary.missed })}
            </p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {t("adherenceExplanation")}
          </p>
        </div>
      </div>
    </Card>
  );
}
