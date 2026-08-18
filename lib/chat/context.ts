import "server-only";

import { requireRole } from "@/lib/auth";
import { deriveDoseStatus, getTodayBounds, SAHARACARE_TIME_ZONE } from "@/lib/dose-config";
import {
  classifyChatContextIntent,
  selectRelevantMedicationIds,
} from "@/lib/chat/safety";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ChatActor = {
  id: string;
  fullName: string;
  role: UserRole;
};

export type CaregiverChatSubject = {
  id: string;
  fullName: string;
};

export class ChatAccessError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 503,
    public readonly publicMessage: string,
    public readonly diagnosticCode: string,
  ) {
    super(publicMessage);
    this.name = "ChatAccessError";
  }
}

function cleanContextText(value: string | null, maxLength = 160) {
  if (!value) return null;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || null;
}

function formatKathmanduTimestamp(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAHARACARE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export async function getAuthenticatedChatActor(
  supabase: ServerSupabaseClient,
): Promise<ChatActor> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new ChatAccessError(401, "Please sign in again to use the assistant.", "auth_user_missing");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError
    || !profile
    || (profile.role !== "patient" && profile.role !== "caregiver")
  ) {
    throw new ChatAccessError(
      403,
      "Your SaharaCare profile cannot use the assistant.",
      "profile_unavailable",
    );
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
  };
}

async function resolveChatSubject(
  supabase: ServerSupabaseClient,
  actor: ChatActor,
  requestedPatientId: string | null,
) {
  if (actor.role === "patient") {
    if (requestedPatientId && requestedPatientId !== actor.id) {
      throw new ChatAccessError(403, "You cannot access that patient.", "patient_subject_mismatch");
    }
    return { id: actor.id, fullName: actor.fullName };
  }

  if (!requestedPatientId || !uuidPattern.test(requestedPatientId)) {
    throw new ChatAccessError(
      400,
      "Choose an approved patient before sending a message.",
      "caregiver_subject_required",
    );
  }

  const { data: link, error: linkError } = await supabase
    .from("caregiver_links")
    .select("patient_id")
    .eq("caregiver_id", actor.id)
    .eq("patient_id", requestedPatientId)
    .eq("status", "accepted")
    .maybeSingle();

  if (linkError) {
    throw new ChatAccessError(
      503,
      "Patient access could not be verified. Please try again.",
      "caregiver_link_query_failed",
    );
  }

  if (!link) {
    throw new ChatAccessError(403, "You cannot access that patient.", "caregiver_link_denied");
  }

  const { data: patient, error: patientError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", link.patient_id)
    .eq("role", "patient")
    .maybeSingle();

  if (patientError) {
    throw new ChatAccessError(
      503,
      "Patient information is temporarily unavailable.",
      "patient_profile_query_failed",
    );
  }

  if (!patient) {
    throw new ChatAccessError(403, "You cannot access that patient.", "patient_profile_denied");
  }

  return { id: patient.id, fullName: patient.full_name };
}

type MedicationRow = {
  id: string;
  name: string;
  dosage: string;
};

type ScheduleRow = {
  medication_id: string;
  scheduled_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
};

type DoseRow = {
  medication_id: string;
  scheduled_at: string;
  taken_at: string | null;
  status: string;
};

function safeDoseStatus(value: string) {
  return value === "taken" || value === "late" || value === "missed"
    ? value
    : "scheduled";
}

export async function buildAuthorizedChatContext(
  supabase: ServerSupabaseClient,
  actor: ChatActor,
  requestedPatientId: string | null,
  question: string,
) {
  const subject = await resolveChatSubject(supabase, actor, requestedPatientId);
  const now = new Date();
  const intent = classifyChatContextIntent(question);
  const baseContext = {
    viewerRole: actor.role,
    patientDisplayName: cleanContextText(subject.fullName, 100),
    timezone: SAHARACARE_TIME_ZONE,
    currentLocalTime: formatKathmanduTimestamp(now),
  };

  if (!intent.needsMedicationData) {
    return JSON.stringify({
      ...baseContext,
      medicationContextIncluded: false,
      verifiedApplicationFacts: [],
    });
  }

  const { data: medicationData, error: medicationError } = await supabase
    .from("medications")
    .select("id, name, dosage")
    .eq("patient_id", subject.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(25);

  if (medicationError) {
    throw new ChatAccessError(
      503,
      "Medication information is temporarily unavailable. I will not guess.",
      "medication_query_failed",
    );
  }

  const allMedications = (medicationData ?? []) as MedicationRow[];
  const selectedIds = selectRelevantMedicationIds(question, allMedications);
  const selectedIdSet = new Set(selectedIds);
  const medications = allMedications.filter((medication) => selectedIdSet.has(medication.id));

  if (medications.length === 0) {
    return JSON.stringify({
      ...baseContext,
      medicationContextIncluded: true,
      activeMedications: [],
      todayDoses: [],
      nextUncompletedDose: null,
    });
  }

  const medicationIds = medications.map((medication) => medication.id);
  const { start, end } = getTodayBounds(now);
  const schedulePromise = supabase
    .from("medication_schedules")
    .select("medication_id, scheduled_time, days_of_week, start_date, end_date")
    .in("medication_id", medicationIds)
    .order("scheduled_time", { ascending: true });
  const dosePromise = intent.needsTodayDoses
    ? supabase
        .from("dose_records")
        .select("medication_id, scheduled_at, taken_at, status")
        .eq("patient_id", subject.id)
        .in("medication_id", medicationIds)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at", { ascending: true })
    : Promise.resolve({ data: [] as DoseRow[], error: null });
  const instructionPromise = intent.needsInstructions
    ? supabase
        .from("medications")
        .select("id, instructions")
        .eq("patient_id", subject.id)
        .in("id", medicationIds)
    : Promise.resolve({
        data: [] as Array<{ id: string; instructions: string | null }>,
        error: null,
      });

  const [scheduleResult, doseResult, instructionResult] = await Promise.all([
    schedulePromise,
    dosePromise,
    instructionPromise,
  ]);

  if (scheduleResult.error || doseResult.error || instructionResult.error) {
    throw new ChatAccessError(
      503,
      "Medication information is temporarily unavailable. I will not guess.",
      "medication_context_query_failed",
    );
  }

  const schedules = (scheduleResult.data ?? []) as ScheduleRow[];
  const doses = (doseResult.data ?? []) as DoseRow[];
  const instructionsById = new Map(
    (instructionResult.data ?? []).map((row) => [
      row.id,
      cleanContextText(row.instructions, 300),
    ]),
  );
  const medicationById = new Map(medications.map((medication) => [medication.id, medication]));
  const mappedDoses = doses.flatMap((dose) => {
    const medication = medicationById.get(dose.medication_id);
    if (!medication) return [];
    const persistedStatus = safeDoseStatus(dose.status);
    const status = deriveDoseStatus(persistedStatus, dose.scheduled_at, now);

    return [{
      medication: cleanContextText(medication.name),
      dosage: cleanContextText(medication.dosage),
      scheduledLocalTime: formatKathmanduTimestamp(dose.scheduled_at),
      status,
      takenLocalTime: dose.taken_at ? formatKathmanduTimestamp(dose.taken_at) : null,
    }];
  });
  const nextUncompletedDose = mappedDoses.find((dose) => dose.status !== "taken") ?? null;

  return JSON.stringify({
    ...baseContext,
    medicationContextIncluded: true,
    activeMedications: medications.map((medication) => ({
      name: cleanContextText(medication.name),
      dosage: cleanContextText(medication.dosage),
      storedInstructions: instructionsById.get(medication.id) ?? null,
      schedules: schedules
        .filter((schedule) => schedule.medication_id === medication.id)
        .map((schedule) => ({
          time: schedule.scheduled_time.slice(0, 5),
          weekdays: schedule.days_of_week,
          startDate: schedule.start_date,
          endDate: schedule.end_date,
        })),
    })),
    todayDoses: mappedDoses,
    nextUncompletedDose,
  });
}

export async function getCaregiverChatSubjects(): Promise<CaregiverChatSubject[]> {
  const caregiver = await requireRole("caregiver");
  const supabase = await createClient();
  const { data: links, error: linkError } = await supabase
    .from("caregiver_links")
    .select("patient_id")
    .eq("caregiver_id", caregiver.id)
    .eq("status", "accepted");

  if (linkError || !links?.length) return [];

  const patientIds = [...new Set(links.map((link) => link.patient_id))];
  const { data: patients, error: patientError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", patientIds)
    .eq("role", "patient")
    .order("full_name", { ascending: true });

  if (patientError) return [];

  return (patients ?? []).map((patient) => ({
    id: patient.id,
    fullName: patient.full_name,
  }));
}
