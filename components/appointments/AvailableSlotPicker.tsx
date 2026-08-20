"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { getAvailableAppointmentSlotsAction } from "@/app/actions/appointments";
import { useApp } from "@/components/providers/AppProvider";
import {
  APPOINTMENT_BOOKING_WINDOW_DAYS,
  formatAppointmentTime,
  getKathmanduDateInputValue,
} from "@/lib/appointment-utils";
import { cn } from "@/lib/utils";
import type { AvailableAppointmentSlot } from "@/types";

export function AvailableSlotPicker({
  doctorId,
  date,
  onDateChange,
  selectedSlot,
  onSlotChange,
  idPrefix = "appointment",
}: {
  doctorId: string;
  date: string;
  onDateChange: (date: string) => void;
  selectedSlot: string;
  onSlotChange: (startsAt: string) => void;
  idPrefix?: string;
}) {
  const { language, t } = useApp();
  const [slots, setSlots] = useState<AvailableAppointmentSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimumDate = useMemo(() => getKathmanduDateInputValue(), []);
  const maximumDate = useMemo(() => {
    const value = new Date(`${minimumDate}T00:00:00+05:45`);
    value.setUTCDate(value.getUTCDate() + APPOINTMENT_BOOKING_WINDOW_DAYS);
    return getKathmanduDateInputValue(value);
  }, [minimumDate]);

  useEffect(() => {
    let active = true;
    onSlotChange("");
    setSlots([]);
    setError(null);
    if (!doctorId || !date) return () => { active = false; };

    setLoading(true);
    void getAvailableAppointmentSlotsAction(doctorId, date).then((response) => {
      if (!active) return;
      setSlots(response.slots);
      setError(response.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [date, doctorId, onSlotChange]);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-date`} className="mb-2 block font-bold">
          {t("selectDate")}
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          value={date}
          min={minimumDate}
          max={maximumDate}
          required
          onChange={(event) => onDateChange(event.target.value)}
          className="min-h-14 w-full rounded-2xl border-2 bg-card px-4 text-base font-semibold focus:border-primary"
        />
      </div>

      <fieldset>
        <legend className="mb-3 font-bold">{t("availableTimes")}</legend>
        <div aria-live="polite">
          {!doctorId ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-muted dark:bg-slate-900">
              {t("chooseDoctorFirst")}
            </p>
          ) : loading ? (
            <p className="rounded-2xl bg-slate-50 p-4 font-semibold text-muted dark:bg-slate-900">
              {t("loadingAvailableTimes")}
            </p>
          ) : error ? (
            <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-800 dark:bg-red-950/30 dark:text-red-100">
              {t("availableTimesError")}
            </p>
          ) : date && slots.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-muted dark:bg-slate-900">
              {t("noAvailableTimes")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map((slot) => (
                <label
                  key={slot.starts_at}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-3 text-center font-extrabold focus-within:ring-4 focus-within:ring-primary/30",
                    selectedSlot === slot.starts_at
                      ? "border-primary bg-blue-50 text-primary dark:bg-blue-950/40"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-available-slot`}
                    value={slot.starts_at}
                    checked={selectedSlot === slot.starts_at}
                    onChange={() => onSlotChange(slot.starts_at)}
                    className="sr-only"
                  />
                  <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {formatAppointmentTime(slot.starts_at, language)}
                </label>
              ))}
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}
