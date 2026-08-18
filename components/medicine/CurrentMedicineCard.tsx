"use client";

import { motion } from "framer-motion";
import { Clock3, Pill } from "lucide-react";
import { MarkDoseTakenButton } from "@/components/doses/MarkDoseTakenButton";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDoseTimestamp } from "@/lib/dose-config";
import type { DoseStatus, TodayDose } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

export function CurrentMedicineCard({ dose }: { dose: TodayDose }) {
  const { language, t } = useApp();
  const statusLabels: Record<DoseStatus, string> = {
    scheduled: t("scheduled"),
    taken: t("taken"),
    late: t("late"),
    missed: t("missed"),
  };
  const urgent = dose.status === "late" || dose.status === "missed";
  const scheduledTime = new Date(dose.scheduled_at).getTime();
  const minutesUntilDose = (scheduledTime - Date.now()) / 60_000;
  const isDueNow = dose.status === "scheduled"
    && Number.isFinite(minutesUntilDose)
    && minutesUntilDose <= 1
    && minutesUntilDose > -15;

  return (
    <Card className="overflow-hidden border-blue-100">
      <div className={`px-5 py-4 ${
        urgent
          ? "bg-amber-50 dark:bg-amber-950/30"
          : dose.status === "taken"
            ? "bg-green-50 dark:bg-green-950/30"
            : "bg-blue-50 dark:bg-blue-950/50"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">
            {t(dose.status === "taken" ? "doseRecorded" : "currentScheduledDose")}
          </p>
          <StatusPill
            status={dose.status}
            label={isDueNow ? t("dueNow") : statusLabels[dose.status]}
          />
        </div>
      </div>
      <div className="p-5 md:p-8">
        <div className="grid grid-cols-[104px_1fr] gap-4 md:grid-cols-[140px_1fr] md:gap-6">
          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-50 dark:from-blue-950 dark:to-slate-800" aria-label={t("medicationIllustration")}>
            <div className="absolute h-20 w-20 rounded-full bg-white/70 md:h-28 md:w-28" />
            <Pill className="relative h-14 w-14 rotate-45 text-primary md:h-20 md:w-20" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold md:text-4xl">{dose.medication.name}</h2>
            <p className="mt-1 text-lg font-semibold text-primary md:text-xl">{dose.medication.dosage}</p>
            <p className="mt-4 flex items-center gap-2 font-bold">
              <Clock3 className="h-6 w-6 text-muted" />
              {formatDoseTimestamp(dose.scheduled_at, language)}
            </p>
            {dose.medication.instructions ? (
              <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-muted dark:bg-slate-800">
                {dose.medication.instructions}
              </p>
            ) : null}
          </div>
        </div>
        <motion.div whileTap={{ scale: 0.98 }} className="mt-7">
          <MarkDoseTakenButton
            doseId={dose.id}
            status={dose.status}
            takenAt={dose.taken_at}
            large
          />
        </motion.div>
      </div>
    </Card>
  );
}
