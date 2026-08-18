import type { Medication, MedicationSchedule } from "@/types";
import type { Language } from "@/types";

export const WEEKDAYS = [
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
] as const;

export function formatMedicationTime(value: string, language: Language = "en") {
  const [hours = "0", minutes = "0"] = value.split(":");
  const date = new Date(Date.UTC(2020, 0, 1, Number(hours), Number(minutes)));
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function inputTime(value: string) {
  return value.slice(0, 5);
}

export function formatScheduleDays(days: number[], language: Language = "en") {
  const uniqueDays = [...new Set(days)].sort((a, b) => a - b);

  if (uniqueDays.length === 7) return language === "ne" ? "हरेक दिन" : "Every day";
  if (
    uniqueDays.length === 5
    && uniqueDays.every((day, index) => day === index + 1)
  ) return language === "ne" ? "कामकाजी दिन" : "Weekdays";

  const localizedDays = language === "ne"
    ? ["आइत", "सोम", "मङ्गल", "बुध", "बिही", "शुक्र", "शनि"]
    : WEEKDAYS.map((day) => day.short);

  return uniqueDays
    .map((day) => localizedDays[day])
    .filter(Boolean)
    .join(", ");
}

export type ScheduledMedication = {
  medication: Medication;
  schedule: MedicationSchedule;
};

export function flattenMedicationSchedules(
  medications: Medication[],
  activeOnly = true,
) {
  return medications
    .filter((medication) => !activeOnly || medication.active)
    .flatMap((medication) => medication.schedules.map((schedule) => ({
      medication,
      schedule,
    })))
    .sort((left, right) => left.schedule.scheduled_time.localeCompare(
      right.schedule.scheduled_time,
    ));
}
