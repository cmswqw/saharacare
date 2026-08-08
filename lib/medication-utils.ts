import type { Medication, MedicationSchedule } from "@/types";

export const WEEKDAYS = [
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
] as const;

export function formatMedicationTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes.padStart(2, "0")} ${suffix}`;
}

export function inputTime(value: string) {
  return value.slice(0, 5);
}

export function formatScheduleDays(days: number[]) {
  const uniqueDays = [...new Set(days)].sort((a, b) => a - b);

  if (uniqueDays.length === 7) return "Every day";
  if (
    uniqueDays.length === 5
    && uniqueDays.every((day, index) => day === index + 1)
  ) return "Weekdays";

  return uniqueDays
    .map((day) => WEEKDAYS.find((item) => item.value === day)?.short)
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
