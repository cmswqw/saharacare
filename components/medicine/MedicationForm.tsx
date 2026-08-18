"use client";

import { useActionState, useEffect, useState } from "react";
import { Clock3, Plus, Save, Trash2 } from "lucide-react";
import { saveMedicationAction } from "@/app/actions/phase4";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/components/providers/AppProvider";
import { inputTime, WEEKDAYS } from "@/lib/medication-utils";
import type { Medication, Phase4ActionState } from "@/types";

const initialState: Phase4ActionState = { status: "idle", message: "" };

const fieldClassName = "mt-2 min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-base";

export function MedicationForm({
  medication,
  onClose,
}: {
  medication: Medication | null;
  onClose: () => void;
}) {
  const { language, t } = useApp();
  const [state, formAction, pending] = useActionState(saveMedicationAction, initialState);
  const [times, setTimes] = useState<string[]>(
    medication?.schedules.length
      ? medication.schedules.map((schedule) => inputTime(schedule.scheduled_time))
      : ["08:00"],
  );
  const selectedDays = medication?.schedules[0]?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6];

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [onClose, state.nonce, state.status]);

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={t(medication ? "editMedication" : "addMedication")}
      description={t("medicationDialogDescription")}
    >
      <form action={formAction} className="min-w-0 space-y-5">
        <input type="hidden" name="medication_id" value={medication?.id ?? ""} />
        <input type="hidden" name="active" value={String(medication?.active ?? true)} />

        <label className="block font-bold">
          {t("medicationName")}
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={medication?.name ?? ""}
            placeholder={t("medicationNamePlaceholder")}
            className={fieldClassName}
          />
        </label>

        <label className="block font-bold">
          {t("dosage")}
          <input
            name="dosage"
            required
            maxLength={120}
            defaultValue={medication?.dosage ?? ""}
            placeholder={t("dosagePlaceholder")}
            className={fieldClassName}
          />
        </label>

        <label className="block font-bold">
          {t("instructions")} <span className="font-normal text-muted">({t("optional")})</span>
          <textarea
            name="instructions"
            maxLength={500}
            rows={3}
            defaultValue={medication?.instructions ?? ""}
            placeholder={t("instructionsPlaceholder")}
            className={`${fieldClassName} py-3`}
          />
        </label>

        <fieldset>
          <legend className="font-bold">{t("scheduledTimes")}</legend>
          <div className="mt-3 space-y-3">
            {times.map((time, index) => (
              <div key={`${index}-${time}`} className="flex items-center gap-3">
                <Clock3 className="shrink-0 text-primary" />
                <input
                  type="time"
                  name="scheduled_times"
                  required
                  defaultValue={time}
                  className="min-h-14 min-w-0 flex-1 rounded-2xl border-2 bg-card px-4 text-lg font-bold"
                />
                {times.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeTime", { number: index + 1 })}
                    onClick={() => setTimes((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          {times.length < 8 ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => setTimes((items) => [...items, "12:00"])}
            >
              <Plus />{t("addAnotherTime")}
            </Button>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="font-bold">{t("days")}</legend>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="cursor-pointer text-center">
                <input
                  type="checkbox"
                  name="schedule_days"
                  value={day.value}
                  defaultChecked={selectedDays.includes(day.value)}
                  className="peer sr-only"
                />
                <span className="grid min-h-12 place-items-center rounded-xl border-2 font-bold peer-checked:border-primary peer-checked:bg-blue-50 peer-checked:text-primary dark:peer-checked:bg-blue-950/40">
                  {t(([
                    "sundayShort",
                    "mondayShort",
                    "tuesdayShort",
                    "wednesdayShort",
                    "thursdayShort",
                    "fridayShort",
                    "saturdayShort",
                  ] as const)[day.value])}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {state.status === "error" ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800 dark:bg-red-950/30 dark:text-red-200">
            {language === "ne" ? t("medicationSaveError") : state.message}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-2 flex flex-col-reverse gap-3 border-t bg-card/95 px-2 pb-1 pt-4 backdrop-blur sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" size="large" disabled={pending}>
            <Save />{pending ? t("saving") : t(medication ? "saveChanges" : "addMedication")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
