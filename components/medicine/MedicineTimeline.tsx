"use client";

import { Clock3, Pill } from "lucide-react";
import {
  flattenMedicationSchedules,
  formatMedicationTime,
  formatScheduleDays,
} from "@/lib/medication-utils";
import type { Medication } from "@/types";
import { useApp } from "@/components/providers/AppProvider";

export function MedicineTimeline({ medications }: { medications: Medication[] }) {
  const { language, t } = useApp();
  const schedule = flattenMedicationSchedules(medications);

  if (schedule.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-5 text-muted dark:bg-slate-900">{t("noActiveMedicationTimes")}</p>;
  }

  return (
    <div className="space-y-1">
      {schedule.map(({ medication, schedule: item }, index) => (
        <div key={item.id} className="relative grid grid-cols-[48px_1fr] gap-3 pb-5">
          <div className="relative flex justify-center">
            {index < schedule.length - 1 ? (
              <span className="absolute bottom-0 top-10 w-0.5 bg-slate-200 dark:bg-slate-700" />
            ) : null}
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-primary">
              <Clock3 />
            </span>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold">{formatMedicationTime(item.scheduled_time, language)}</p>
                <p className="mt-1 flex items-center gap-2 font-bold">
                  <Pill className="h-5 w-5 rotate-45 text-primary" />
                  {medication.name} · {medication.dosage}
                </p>
                {medication.instructions ? (
                  <p className="mt-2 text-sm text-muted">{medication.instructions}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-extrabold text-primary dark:bg-blue-950/40">
                {formatScheduleDays(item.days_of_week, language)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
