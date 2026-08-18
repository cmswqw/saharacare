"use client";

import { History, Pill } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDoseDate, formatDoseTimestamp } from "@/lib/dose-config";
import type { DoseHistoryItem, DoseStatus } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

export function MedicationHistory({ history }: { history: DoseHistoryItem[] }) {
  const { language, t } = useApp();
  const statusLabels: Record<DoseStatus, string> = {
    scheduled: t("scheduled"),
    taken: t("taken"),
    late: t("late"),
    missed: t("missed"),
  };
  return (
    <section>
      <div className="mb-5">
        <p className="eyebrow">{t("realDoseRecords")}</p>
        <h2 className="section-title mt-1">{t("recentMedicationHistory")}</h2>
      </div>
      {history.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <History className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-3 text-xl font-extrabold">{t("noDoseHistory")}</h3>
          <p className="mt-2 text-muted">{t("noDoseHistoryHelp")}</p>
        </Card>
      ) : (
        <Card className="divide-y p-2">
          {history.map((dose) => (
            <article key={dose.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-lg font-extrabold">
                  <Pill className="h-5 w-5 rotate-45 text-primary" />
                  {dose.medication.name} · {dose.medication.dosage}
                </p>
                <p className="mt-2 font-semibold text-muted">
                  {formatDoseDate(dose.scheduled_at, language)} · {t("scheduledAt", { time: formatDoseTimestamp(dose.scheduled_at, language) })}
                </p>
                {dose.taken_at ? (
                  <p className="mt-1 font-bold text-success">
                    {t("takenLateAt", { time: formatDoseTimestamp(dose.taken_at, language), late: dose.taken_late ? t("takenLateSuffix") : "" })}
                  </p>
                ) : null}
              </div>
              <StatusPill status={dose.status} label={statusLabels[dose.status]} />
            </article>
          ))}
        </Card>
      )}
    </section>
  );
}
