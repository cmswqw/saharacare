import type { DoseStatus, TodayDose } from "@/types";
import type { Language } from "@/types";

export const SAHARACARE_TIME_ZONE = "Asia/Kathmandu";
export const LATE_AFTER_MINUTES = 15;
export const MISSED_AFTER_MINUTES = 120;

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAHARACARE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function zonedDateTimeToUtc(target: ZonedDateTimeParts) {
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  let candidate = targetAsUtc;

  // Iterating accounts for timezone offsets without assuming that UTC equals
  // the user's displayed day. It also remains usable if this prototype later
  // changes to a timezone with daylight-saving transitions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getZonedParts(new Date(candidate));
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = targetAsUtc - observedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate);
}

export function getTodayBounds(now = new Date()) {
  const local = getZonedParts(now);
  const nextCalendarDay = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  const start = zonedDateTimeToUtc({
    year: local.year,
    month: local.month,
    day: local.day,
    hour: 0,
    minute: 0,
    second: 0,
  });
  const end = zonedDateTimeToUtc({
    year: nextCalendarDay.getUTCFullYear(),
    month: nextCalendarDay.getUTCMonth() + 1,
    day: nextCalendarDay.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  });

  return { start: start.toISOString(), end: end.toISOString() };
}

export function getLocalCalendarWindowStart(days: number, now = new Date()) {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("Calendar window must include at least one day.");
  }

  const local = getZonedParts(now);
  const startCalendarDay = new Date(Date.UTC(
    local.year,
    local.month - 1,
    local.day - (days - 1),
  ));

  return zonedDateTimeToUtc({
    year: startCalendarDay.getUTCFullYear(),
    month: startCalendarDay.getUTCMonth() + 1,
    day: startCalendarDay.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  }).toISOString();
}

export function deriveDoseStatus(
  persistedStatus: DoseStatus,
  scheduledAt: string,
  now = new Date(),
): DoseStatus {
  // A persisted state is authoritative. The elapsed-time fallback is only for
  // scheduled rows that have not yet been evaluated by the database.
  if (persistedStatus !== "scheduled") return persistedStatus;

  const elapsedMinutes = (now.getTime() - new Date(scheduledAt).getTime()) / 60_000;
  if (elapsedMinutes >= MISSED_AFTER_MINUTES) return "missed";
  if (elapsedMinutes >= LATE_AFTER_MINUTES) return "late";
  return "scheduled";
}

export function formatDoseTimestamp(value: string, language: Language = "en") {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    timeZone: SAHARACARE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDoseDate(value: string, language: Language = "en") {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    timeZone: SAHARACARE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function countDoseStatuses(doses: TodayDose[]) {
  return doses.reduce<Record<DoseStatus, number>>((counts, dose) => {
    counts[dose.status] += 1;
    return counts;
  }, { scheduled: 0, taken: 0, late: 0, missed: 0 });
}
