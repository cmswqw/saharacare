import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import type {
  Appointment,
  AppointmentActorRole,
  AppointmentMedicalFile,
  AppointmentMedicalShare,
  AppointmentStatus,
  DoctorAvailability,
  DoctorAvailabilityOverride,
} from "@/types";

type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  facility: string;
  purpose: string;
  note: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  created_by: string;
  created_by_role: AppointmentActorRole;
  updated_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  doctor: ProfileRelation;
  patient: ProfileRelation;
  creator: ProfileRelation;
};

const appointmentSelection = `
  id,
  patient_id,
  doctor_id,
  facility,
  purpose,
  note,
  starts_at,
  ends_at,
  status,
  created_by,
  created_by_role,
  updated_by,
  cancelled_by,
  cancelled_at,
  created_at,
  doctor:profiles!appointments_doctor_id_fkey(full_name),
  patient:profiles!appointments_patient_id_fkey(full_name),
  creator:profiles!appointments_created_by_fkey(full_name)
`;

function relationName(value: ProfileRelation) {
  if (Array.isArray(value)) return value[0]?.full_name ?? "Unknown";
  return value?.full_name ?? "Unknown";
}

function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    doctor_name: relationName(row.doctor),
    patient_name: relationName(row.patient),
    facility: row.facility,
    purpose: row.purpose,
    note: row.note,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    created_by: row.created_by,
    created_by_role: row.created_by_role,
    created_by_name: relationName(row.creator),
    updated_by: row.updated_by,
    cancelled_by: row.cancelled_by,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
  };
}

export async function getDoctors() {
  const profile = await requireProfile();
  if (profile.role !== "patient" && profile.role !== "caregiver") {
    return { data: [], error: "This role cannot book appointments." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "doctor")
    .eq("account_status", "active")
    .order("full_name");
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getAppointments(patientId?: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  if (profile.role === "doctor") {
    const { data, error } = await supabase
      .from("appointments")
      .select(appointmentSelection)
      .eq("doctor_id", profile.id)
      .order("starts_at", { ascending: true });
    return {
      data: ((data ?? []) as unknown as AppointmentRow[]).map(mapAppointment),
      error: error?.message ?? null,
    };
  }

  if (profile.role === "patient") {
    const { data, error } = await supabase
      .from("appointments")
      .select(appointmentSelection)
      .eq("patient_id", profile.id)
      .order("starts_at", { ascending: true });
    return {
      data: ((data ?? []) as unknown as AppointmentRow[]).map(mapAppointment),
      error: error?.message ?? null,
    };
  }

  if (profile.role !== "caregiver" || !patientId) {
    return {
      data: [],
      error: profile.role === "caregiver" ? "Choose a linked patient." : null,
    };
  }

  const { data: link, error: linkError } = await supabase
    .from("caregiver_links")
    .select("id")
    .eq("caregiver_id", profile.id)
    .eq("patient_id", patientId)
    .eq("status", "accepted")
    .maybeSingle();
  if (linkError || !link) {
    return {
      data: [],
      error: linkError?.message ?? "This patient is not linked to your account.",
    };
  }

  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelection)
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: true });
  return {
    data: ((data ?? []) as unknown as AppointmentRow[]).map(mapAppointment),
    error: error?.message ?? null,
  };
}

export async function getAppointment(appointmentId: string) {
  const profile = await requireProfile();
  if (profile.role !== "doctor" && profile.role !== "patient") {
    return {
      data: null,
      share: null,
      error: "This role cannot access appointment files.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(appointmentSelection)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !data) {
    return {
      data: null,
      share: null,
      error: error?.message ?? "Appointment not found.",
    };
  }

  const appointment = mapAppointment(data as unknown as AppointmentRow);
  const { data: shares, error: shareError } = await supabase
    .from("appointment_medical_shares")
    .select("id, appointment_id, expires_at, revoked_at, created_at, appointment_medical_files(id, share_id, original_filename, mime_type, size_bytes, kind, created_at)")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1);
  const rawShare = shares?.[0] as undefined | {
    id: string;
    appointment_id: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
    appointment_medical_files: AppointmentMedicalFile[] | null;
  };
  const share: AppointmentMedicalShare | null = rawShare ? {
    id: rawShare.id,
    appointment_id: rawShare.appointment_id,
    expires_at: rawShare.expires_at,
    revoked_at: rawShare.revoked_at,
    created_at: rawShare.created_at,
    files: rawShare.appointment_medical_files ?? [],
  } : null;
  return { data: appointment, share, error: shareError?.message ?? null };
}

export async function getDoctorAvailability() {
  const profile = await requireRole("doctor");
  const supabase = await createClient();
  const [weekly, overrides] = await Promise.all([
    supabase
      .from("doctor_availability")
      .select("id, doctor_id, day_of_week, start_time, end_time, created_at, updated_at")
      .eq("doctor_id", profile.id)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("doctor_availability_overrides")
      .select("id, doctor_id, override_date, override_type, start_time, end_time, created_at, updated_at")
      .eq("doctor_id", profile.id)
      .order("override_date")
      .order("start_time"),
  ]);

  return {
    weekly: (weekly.data ?? []) as DoctorAvailability[],
    overrides: (overrides.data ?? []) as DoctorAvailabilityOverride[],
    error: weekly.error?.message ?? overrides.error?.message ?? null,
  };
}
