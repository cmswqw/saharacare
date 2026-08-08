import "server-only";

import {
  ADHERENCE_WINDOW_DAYS,
  calculateAdherence,
  RECENT_HISTORY_DAYS,
  RECENT_HISTORY_LIMIT,
  wasDoseTakenLate,
} from "@/lib/adherence";
import { requireRole } from "@/lib/auth";
import { getLocalCalendarWindowStart } from "@/lib/dose-config";
import { mapDoseRecord, type DoseRecordRow } from "@/lib/data/doses";
import { createClient } from "@/lib/supabase/server";
import type { AdherenceSummary, DoseHistoryItem, Medication } from "@/types";

type AnalyticsResult = {
  data: {
    weekly: AdherenceSummary;
    history: DoseHistoryItem[];
  };
  error: string | null;
};

const doseSelection = "id, patient_id, medication_id, schedule_id, scheduled_at, taken_at, status";

export async function getOwnDoseAnalytics(): Promise<AnalyticsResult> {
  const profile = await requireRole("patient");
  const supabase = await createClient();
  const now = new Date();
  const weeklyStart = getLocalCalendarWindowStart(ADHERENCE_WINDOW_DAYS, now);
  const historyStart = getLocalCalendarWindowStart(RECENT_HISTORY_DAYS, now);
  const { error: ensureError } = await supabase.rpc("ensure_today_doses");
  if (ensureError) {
    return {
      data: { weekly: calculateAdherence([], now), history: [] },
      error: ensureError.message,
    };
  }
  const { error: evaluationError } = await supabase.rpc("evaluate_own_due_doses");
  if (evaluationError) {
    return {
      data: { weekly: calculateAdherence([], now), history: [] },
      error: evaluationError.message,
    };
  }

  const [weeklyResult, historyResult] = await Promise.all([
    supabase
      .from("dose_records")
      .select(doseSelection)
      .eq("patient_id", profile.id)
      .gte("scheduled_at", weeklyStart)
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("dose_records")
      .select(doseSelection)
      .eq("patient_id", profile.id)
      .gte("scheduled_at", historyStart)
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(RECENT_HISTORY_LIMIT),
  ]);

  if (weeklyResult.error || historyResult.error) {
    return {
      data: { weekly: calculateAdherence([], now), history: [] },
      error: weeklyResult.error?.message ?? historyResult.error?.message ?? "Unknown error",
    };
  }

  const weeklyRows = (weeklyResult.data ?? []) as DoseRecordRow[];
  const historyRows = (historyResult.data ?? []) as DoseRecordRow[];
  const medicationIds = [...new Set(
    [...weeklyRows, ...historyRows].map((dose) => dose.medication_id),
  )];
  const medicationsById = new Map<string, Pick<
    Medication,
    "id" | "name" | "dosage" | "instructions"
  >>();

  if (medicationIds.length > 0) {
    const { data: medications, error } = await supabase
      .from("medications")
      .select("id, name, dosage, instructions")
      .in("id", medicationIds);

    if (error) {
      return {
        data: { weekly: calculateAdherence([], now), history: [] },
        error: error.message,
      };
    }

    for (const medication of medications ?? []) {
      medicationsById.set(medication.id, medication);
    }
  }

  const history = historyRows.flatMap((row) => {
    const medication = medicationsById.get(row.medication_id);
    if (!medication) return [];
    const mapped = mapDoseRecord(row, medication, now);
    return [{
      ...mapped,
      taken_late: wasDoseTakenLate(mapped),
    }];
  });

  return {
    data: {
      weekly: calculateAdherence(weeklyRows.map((row) => ({
        scheduled_at: row.scheduled_at,
        taken_at: row.taken_at,
        status: row.status === "taken" || row.status === "late" || row.status === "missed"
          ? row.status
          : "scheduled",
      })), now),
      history,
    },
    error: null,
  };
}
