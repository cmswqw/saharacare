import "server-only";

import {
  ADHERENCE_WINDOW_DAYS,
  calculateAdherence,
  EMPTY_ADHERENCE_SUMMARY,
  RECENT_HISTORY_DAYS,
  RECENT_HISTORY_LIMIT,
  wasDoseTakenLate,
} from "@/lib/adherence";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLocalCalendarWindowStart, getTodayBounds } from "@/lib/dose-config";
import { mapDoseRecord, type DoseRecordRow } from "@/lib/data/doses";
import type {
  CaregiverLinkStatus,
  LinkedCaregiver,
  LinkedPatient,
  Medication,
  MedicationSchedule,
} from "@/types";

type DataResult<T> = {
  data: T;
  error: string | null;
};

type MedicationRow = Omit<Medication, "schedules"> & {
  patient_id: string;
  medication_schedules: MedicationSchedule[] | null;
};

function mapMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    instructions: row.instructions,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    schedules: [...(row.medication_schedules ?? [])].sort((left, right) => (
      left.scheduled_time.localeCompare(right.scheduled_time)
    )),
  };
}

const medicationSelection = `
  id,
  patient_id,
  name,
  dosage,
  instructions,
  active,
  created_at,
  updated_at,
  medication_schedules (
    id,
    medication_id,
    scheduled_time,
    days_of_week,
    start_date,
    end_date
  )
`;

export async function getOwnMedications(): Promise<DataResult<Medication[]>> {
  const profile = await requireRole("patient");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .select(medicationSelection)
    .eq("patient_id", profile.id)
    .order("created_at", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return {
    data: ((data ?? []) as unknown as MedicationRow[]).map(mapMedication),
    error: null,
  };
}

export async function getPatientLinkingData(): Promise<DataResult<{
  linkingCode: string | null;
  links: LinkedCaregiver[];
}>> {
  const profile = await requireRole("patient");
  const supabase = await createClient();

  const [profileResult, linksResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("linking_code")
      .eq("id", profile.id)
      .single(),
    supabase
      .from("caregiver_links")
      .select("id, caregiver_id, status, created_at")
      .eq("patient_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error || linksResult.error) {
    return {
      data: { linkingCode: null, links: [] },
      error: profileResult.error?.message ?? linksResult.error?.message ?? "Unknown error",
    };
  }

  const rawLinks = (linksResult.data ?? []) as Array<{
    id: string;
    caregiver_id: string;
    status: CaregiverLinkStatus;
    created_at: string;
  }>;
  const caregiverIds = rawLinks.map((link) => link.caregiver_id);
  const caregiversById = new Map<string, {
    full_name: string;
    avatar_url: string | null;
  }>();

  if (caregiverIds.length > 0) {
    const { data: caregivers, error: caregiverError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", caregiverIds);

    if (caregiverError) {
      return {
        data: { linkingCode: profileResult.data?.linking_code ?? null, links: [] },
        error: caregiverError.message,
      };
    }

    for (const caregiver of caregivers ?? []) {
      caregiversById.set(caregiver.id, {
        full_name: caregiver.full_name,
        avatar_url: caregiver.avatar_url,
      });
    }
  }

  return {
    data: {
      linkingCode: profileResult.data?.linking_code ?? null,
      links: rawLinks.map((link) => ({
        link_id: link.id,
        status: link.status,
        created_at: link.created_at,
        caregiver: caregiversById.get(link.caregiver_id) ?? null,
      })),
    },
    error: null,
  };
}

export async function getCaregiverPatients(): Promise<DataResult<LinkedPatient[]>> {
  const profile = await requireRole("caregiver");
  const supabase = await createClient();
  const { data: linkRows, error: linkError } = await supabase
    .from("caregiver_links")
    .select("id, patient_id, status, created_at")
    .eq("caregiver_id", profile.id)
    .order("created_at", { ascending: false });

  if (linkError) return { data: [], error: linkError.message };

  const links = (linkRows ?? []) as Array<{
    id: string;
    patient_id: string;
    status: CaregiverLinkStatus;
    created_at: string;
  }>;
  const acceptedIds = links
    .filter((link) => link.status === "accepted")
    .map((link) => link.patient_id);
  const patientsById = new Map<string, {
    full_name: string;
    avatar_url: string | null;
    linking_code: string | null;
  }>();
  const medicationsByPatient = new Map<string, Medication[]>();
  const medicationsById = new Map<string, Medication>();
  const dosesByPatient = new Map<string, LinkedPatient["today_doses"]>();
  const adherenceByPatient = new Map<string, LinkedPatient["weekly_adherence"]>();
  const historyByPatient = new Map<string, LinkedPatient["recent_history"]>();

  if (acceptedIds.length > 0) {
    const now = new Date();
    const { start, end } = getTodayBounds(now);
    const weeklyStart = getLocalCalendarWindowStart(ADHERENCE_WINDOW_DAYS, now);
    const historyStart = getLocalCalendarWindowStart(RECENT_HISTORY_DAYS, now);
    const [patientsResult, medicationsResult, dosesResult, analyticsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, linking_code")
        .in("id", acceptedIds),
      supabase
        .from("medications")
        .select(medicationSelection)
        .in("patient_id", acceptedIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("dose_records")
        .select("id, patient_id, medication_id, schedule_id, scheduled_at, taken_at, status")
        .in("patient_id", acceptedIds)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("dose_records")
        .select("id, patient_id, medication_id, schedule_id, scheduled_at, taken_at, status")
        .in("patient_id", acceptedIds)
        .gte("scheduled_at", historyStart)
        .lte("scheduled_at", now.toISOString())
        .order("scheduled_at", { ascending: false }),
    ]);

    if (
      patientsResult.error
      || medicationsResult.error
      || dosesResult.error
      || analyticsResult.error
    ) {
      return {
        data: [],
        error: patientsResult.error?.message
          ?? medicationsResult.error?.message
          ?? dosesResult.error?.message
          ?? analyticsResult.error?.message
          ?? "Unknown error",
      };
    }

    for (const patient of patientsResult.data ?? []) {
      patientsById.set(patient.id, {
        full_name: patient.full_name,
        avatar_url: patient.avatar_url,
        linking_code: patient.linking_code,
      });
    }

    for (const row of (medicationsResult.data ?? []) as unknown as MedicationRow[]) {
      const medication = mapMedication(row);
      medicationsById.set(medication.id, medication);
      if (medication.active) {
        medicationsByPatient.set(
          row.patient_id,
          [...(medicationsByPatient.get(row.patient_id) ?? []), medication],
        );
      }
    }

    for (const row of (dosesResult.data ?? []) as DoseRecordRow[]) {
      const medication = medicationsById.get(row.medication_id);
      if (!medication) continue;
      dosesByPatient.set(
        row.patient_id,
        [
          ...(dosesByPatient.get(row.patient_id) ?? []),
          mapDoseRecord(row, medication, now),
        ],
      );
    }

    const analyticsRowsByPatient = new Map<string, DoseRecordRow[]>();
    for (const row of (analyticsResult.data ?? []) as DoseRecordRow[]) {
      analyticsRowsByPatient.set(
        row.patient_id,
        [...(analyticsRowsByPatient.get(row.patient_id) ?? []), row],
      );
    }

    for (const patientId of acceptedIds) {
      const rows = analyticsRowsByPatient.get(patientId) ?? [];
      const weeklyStartTime = new Date(weeklyStart).getTime();
      const weeklyRows = rows.filter((row) => (
        new Date(row.scheduled_at).getTime() >= weeklyStartTime
      ));
      adherenceByPatient.set(
        patientId,
        calculateAdherence(weeklyRows.map((row) => ({
          scheduled_at: row.scheduled_at,
          taken_at: row.taken_at,
          status: row.status === "taken" || row.status === "late" || row.status === "missed"
            ? row.status
            : "scheduled",
        })), now),
      );
      historyByPatient.set(
        patientId,
        rows.slice(0, RECENT_HISTORY_LIMIT).flatMap((row) => {
          const medication = medicationsById.get(row.medication_id);
          if (!medication) return [];
          const mapped = mapDoseRecord(row, medication, now);
          return [{ ...mapped, taken_late: wasDoseTakenLate(mapped) }];
        }),
      );
    }
  }

  return {
    data: links.map((link) => {
      const patient = link.status === "accepted"
        ? patientsById.get(link.patient_id)
        : undefined;

      return {
        link_id: link.id,
        patient_id: patient ? link.patient_id : null,
        status: link.status,
        created_at: link.created_at,
        full_name: patient?.full_name ?? null,
        avatar_url: patient?.avatar_url ?? null,
        linking_code: patient?.linking_code ?? null,
        medications: patient ? medicationsByPatient.get(link.patient_id) ?? [] : [],
        today_doses: patient ? dosesByPatient.get(link.patient_id) ?? [] : [],
        weekly_adherence: patient
          ? adherenceByPatient.get(link.patient_id) ?? { ...EMPTY_ADHERENCE_SUMMARY }
          : { ...EMPTY_ADHERENCE_SUMMARY },
        recent_history: patient ? historyByPatient.get(link.patient_id) ?? [] : [],
      };
    }),
    error: null,
  };
}

export async function getLinkedPatientByCode(code: string) {
  const result = await getCaregiverPatients();
  const normalizedCode = code.trim().toUpperCase();

  return {
    data: result.data.find((patient) => (
      patient.status === "accepted"
      && patient.linking_code === normalizedCode
    )) ?? null,
    error: result.error,
  };
}
