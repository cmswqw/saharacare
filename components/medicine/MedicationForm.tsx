"use client";

import { useActionState, useEffect, useState } from "react";
import { Clock3, Plus, Save, Trash2 } from "lucide-react";
import { saveMedicationAction } from "@/app/actions/phase4";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
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
      title={medication ? "Edit medication" : "Add medication"}
      description="Save the medication details and one or more simple scheduled times."
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="medication_id" value={medication?.id ?? ""} />
        <input type="hidden" name="active" value={String(medication?.active ?? true)} />

        <label className="block font-bold">
          Medication name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={medication?.name ?? ""}
            placeholder="e.g. Metformin"
            className={fieldClassName}
          />
        </label>

        <label className="block font-bold">
          Dosage
          <input
            name="dosage"
            required
            maxLength={120}
            defaultValue={medication?.dosage ?? ""}
            placeholder="e.g. 500 mg"
            className={fieldClassName}
          />
        </label>

        <label className="block font-bold">
          Instructions <span className="font-normal text-muted">(optional)</span>
          <textarea
            name="instructions"
            maxLength={500}
            rows={3}
            defaultValue={medication?.instructions ?? ""}
            placeholder="e.g. Take after breakfast"
            className={`${fieldClassName} py-3`}
          />
        </label>

        <fieldset>
          <legend className="font-bold">Scheduled times</legend>
          <div className="mt-3 space-y-3">
            {times.map((time, index) => (
              <div key={`${index}-${time}`} className="flex items-center gap-3">
                <Clock3 className="shrink-0 text-primary" />
                <input
                  type="time"
                  name="scheduled_times"
                  required
                  defaultValue={time}
                  className="min-h-14 flex-1 rounded-2xl border-2 bg-card px-4 text-lg font-bold"
                />
                {times.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove time ${index + 1}`}
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
              <Plus />Add another time
            </Button>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="font-bold">Days</legend>
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
                  {day.short}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {state.status === "error" ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800 dark:bg-red-950/30 dark:text-red-200">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="large" disabled={pending}>
            <Save />{pending ? "Saving…" : medication ? "Save changes" : "Add medication"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
