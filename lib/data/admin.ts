import "server-only";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdminDirectory, AdminDirectoryPerson } from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPerson(value: unknown): value is AdminDirectoryPerson {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.displayName === "string"
    && (value.accountStatus === "active" || value.accountStatus === "inactive");
}

function isPatient(value: unknown) {
  if (!isPerson(value)) return false;
  const patient = value as unknown as Record<string, unknown>;
  return Array.isArray(patient.caregivers)
    && patient.caregivers.every((caregiver: unknown) => (
      isRecord(caregiver)
      && typeof caregiver.id === "string"
      && typeof caregiver.displayName === "string"
    ));
}

function isCaregiver(value: unknown) {
  if (!isPerson(value)) return false;
  const caregiver = value as unknown as Record<string, unknown>;
  return Array.isArray(caregiver.patients)
    && caregiver.patients.every((patient: unknown) => (
      isRecord(patient)
      && typeof patient.id === "string"
      && typeof patient.displayName === "string"
    ));
}

function isDoctor(value: unknown) {
  if (!isPerson(value)) return false;
  const doctor = value as unknown as Record<string, unknown>;
  return doctor.role === "doctor" && typeof doctor.createdAt === "string";
}

function isAdminDirectory(value: unknown): value is AdminDirectory {
  if (!isRecord(value)) return false;
  const summary = value.summary;
  if (!isRecord(summary)) return false;

  const summaryKeys = [
    "totalPatients",
    "patientsWithCaregiver",
    "patientsWithoutCaregiver",
    "activeCaregivers",
    "activeDoctors",
  ];

  if (!summaryKeys.every((key) => typeof summary[key] === "number")) return false;
  if (!Array.isArray(value.patients) || !Array.isArray(value.caregivers) || !Array.isArray(value.doctors)) return false;

  const patientsValid = value.patients.every(isPatient);
  const caregiversValid = value.caregivers.every(isCaregiver);
  const doctorsValid = value.doctors.every(isDoctor);

  return patientsValid && caregiversValid && doctorsValid;
}

export async function getAdminDirectory(): Promise<{
  data: AdminDirectory | null;
  error: string | null;
}> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_directory");

  if (error || !isAdminDirectory(data)) {
    return { data: null, error: error?.message ?? "Invalid admin directory response." };
  }

  return { data, error: null };
}
