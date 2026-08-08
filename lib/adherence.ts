import { deriveDoseStatus, LATE_AFTER_MINUTES } from "@/lib/dose-config";
import type { AdherenceSummary, DoseStatus } from "@/types";

export const ADHERENCE_WINDOW_DAYS = 7;
export const RECENT_HISTORY_DAYS = 30;
export const RECENT_HISTORY_LIMIT = 20;

export type AdherenceDoseInput = {
  scheduled_at: string;
  taken_at: string | null;
  status: DoseStatus;
};

export const EMPTY_ADHERENCE_SUMMARY: AdherenceSummary = {
  percentage: null,
  taken: 0,
  eligible: 0,
  missed: 0,
  late: 0,
  pending: 0,
};

export function wasDoseTakenLate(dose: AdherenceDoseInput) {
  if (!dose.taken_at) return false;
  const delay = new Date(dose.taken_at).getTime() - new Date(dose.scheduled_at).getTime();
  return delay >= LATE_AFTER_MINUTES * 60_000;
}

export function calculateAdherence(
  doses: AdherenceDoseInput[],
  now = new Date(),
): AdherenceSummary {
  const eligible = doses.filter((dose) => {
    const scheduledTime = new Date(dose.scheduled_at).getTime();
    return Number.isFinite(scheduledTime) && scheduledTime <= now.getTime();
  });

  if (eligible.length === 0) return { ...EMPTY_ADHERENCE_SUMMARY };

  let taken = 0;
  let missed = 0;
  let late = 0;
  let pending = 0;

  for (const dose of eligible) {
    if (dose.taken_at || dose.status === "taken") {
      taken += 1;
      if (wasDoseTakenLate(dose)) late += 1;
      continue;
    }

    const status = deriveDoseStatus(dose.status, dose.scheduled_at, now);
    if (status === "missed") missed += 1;
    else if (status === "late") late += 1;
    else pending += 1;
  }

  return {
    percentage: Math.round((taken / eligible.length) * 100),
    taken,
    eligible: eligible.length,
    missed,
    late,
    pending,
  };
}
