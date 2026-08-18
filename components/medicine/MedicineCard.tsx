"use client";

import { CalendarDays, Clock3, Pencil, Pill, Power, Trash2 } from "lucide-react";
import {
  deleteMedicationAction,
  setMedicationActiveAction,
} from "@/app/actions/phase4";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/providers/AppProvider";
import { formatMedicationTime, formatScheduleDays } from "@/lib/medication-utils";
import type { Medication } from "@/types";

export function MedicineCard({
  medication,
  onEdit,
}: {
  medication: Medication;
  onEdit: (medication: Medication) => void;
}) {
  const { language, t } = useApp();
  return (
    <Card className={`overflow-hidden ${medication.active ? "" : "opacity-75"}`}>
      <div className="flex items-start gap-4 p-5 md:p-6">
        <span className={`grid h-20 w-20 shrink-0 place-items-center rounded-3xl ${
          medication.active
            ? "bg-blue-50 text-primary dark:bg-blue-950/40"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
        }`}>
          <Pill className="h-11 w-11 rotate-45" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">{medication.name}</h2>
              <p className="mt-1 text-lg font-bold text-primary">{medication.dosage}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${
              medication.active
                ? "bg-green-100 text-green-800"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}>
              {t(medication.active ? "active" : "inactive")}
            </span>
          </div>
          {medication.instructions ? (
            <p className="mt-3 leading-relaxed text-muted">{medication.instructions}</p>
          ) : null}
        </div>
      </div>

      <div className="border-t p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {medication.schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
              <p className="flex items-center gap-2 text-lg font-extrabold">
                <Clock3 className="text-primary" />
                {formatMedicationTime(schedule.scheduled_time, language)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold text-muted">
                <CalendarDays className="h-5 w-5" />
                {formatScheduleDays(schedule.days_of_week, language)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => onEdit(medication)}>
            <Pencil />{t("editMedicationAction")}
          </Button>
          <form action={setMedicationActiveAction}>
            <input type="hidden" name="medication_id" value={medication.id} />
            <input type="hidden" name="active" value={String(!medication.active)} />
            <Button type="submit" variant={medication.active ? "warning" : "success"}>
              <Power />{t(medication.active ? "deactivate" : "reactivate")}
            </Button>
          </form>
          <form
            action={deleteMedicationAction}
            onSubmit={(event) => {
              if (!window.confirm(t("deleteMedicationConfirm", { name: medication.name }))) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="medication_id" value={medication.id} />
            <Button type="submit" variant="danger"><Trash2 />{t("delete")}</Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
