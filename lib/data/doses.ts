import "server-only";

import { requireRole } from "@/lib/auth";
import { deriveDoseStatus, getTodayBounds } from "@/lib/dose-config";
import { createClient } from "@/lib/supabase/server";
import type { DoseStatus, Medication, TodayDose } from "@/types";

export type DoseRecordRow = {
  id: string;
  patient_id: string;
  medication_id: string;
  schedule_id: string;
  scheduled_at: string;
  taken_at: string | null;
  status: string;
};

type DataResult<T> = {
  data: T;
  error: string | null;
};

function isDoseStatus(value: string): value is DoseStatus {
  return value === "scheduled"
    || value === "taken"
    || value === "late"
    || value === "missed";
}

export function mapDoseRecord(
  row: DoseRecordRow,
  medication: Pick<Medication, "id" | "name" | "dosage" | "instructions">,
  now = new Date(),
): TodayDose {
  const persistedStatus: DoseStatus = isDoseStatus(row.status)
    ? row.status
    : "scheduled";

  return {
    id: row.id,
    schedule_id: row.schedule_id,
    scheduled_at: row.scheduled_at,
    taken_at: row.taken_at,
    persisted_status: persistedStatus,
    status: deriveDoseStatus(persistedStatus, row.scheduled_at, now),
    medication: {
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      instructions: medication.instructions,
    },
  };
}

export async function getTodayDosesForPatient(): Promise<DataResult<TodayDose[]>> {
  const profile = await requireRole("patient");
  const supabase = await createClient();
  const { error: ensureError } = await supabase.rpc("ensure_today_doses");

  if (ensureError) return { data: [], error: ensureError.message };

  const { error: evaluationError } = await supabase.rpc("evaluate_own_due_doses");
  if (evaluationError) return { data: [], error: evaluationError.message };

  const { start, end } = getTodayBounds();
  const { data: doseRows, error: doseError } = await supabase
    .from("dose_records")
    .select("id, patient_id, medication_id, schedule_id, scheduled_at, taken_at, status")
    .eq("patient_id", profile.id)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at", { ascending: true });

  if (doseError) return { data: [], error: doseError.message };
  if (!doseRows?.length) return { data: [], error: null };

  const medicationIds = [...new Set(doseRows.map((dose) => dose.medication_id))];
  const { data: medications, error: medicationError } = await supabase
    .from("medications")
    .select("id, name, dosage, instructions")
    .in("id", medicationIds);

  if (medicationError) return { data: [], error: medicationError.message };

  const medicationsById = new Map(
    (medications ?? []).map((medication) => [medication.id, medication]),
  );
  const now = new Date();
  const doses = (doseRows as DoseRecordRow[]).flatMap((row) => {
    const medication = medicationsById.get(row.medication_id);
    return medication ? [mapDoseRecord(row, medication, now)] : [];
  });

  return { data: doses, error: null };
}
