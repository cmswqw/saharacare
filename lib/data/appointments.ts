import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import type {
  Appointment,
  AppointmentMedicalFile,
  AppointmentMedicalShare,
  AppointmentStatus,
} from "@/types";

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
  created_at: string;
  doctor: { full_name: string } | { full_name: string }[] | null;
  patient: { full_name: string } | { full_name: string }[] | null;
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
  created_at,
  doctor:profiles!appointments_doctor_id_fkey(full_name),
  patient:profiles!appointments_patient_id_fkey(full_name)
`;

function relationName(value: AppointmentRow["doctor"]) {
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
    created_at: row.created_at,
  };
}

export async function getDoctors() {
  await requireRole("patient");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").eq("role", "doctor").order("full_name");
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getAppointments() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const relationColumn = profile.role === "doctor" ? "doctor_id" : "patient_id";
  if (profile.role !== "doctor" && profile.role !== "patient") return { data: [], error: null };
  const { data, error } = await supabase.from("appointments").select(appointmentSelection).eq(relationColumn, profile.id).order("starts_at", { ascending: true });
  return { data: ((data ?? []) as unknown as AppointmentRow[]).map(mapAppointment), error: error?.message ?? null };
}

export async function getAppointment(appointmentId: string) {
  const profile = await requireProfile();
  if (profile.role !== "doctor" && profile.role !== "patient") return { data: null, share: null, error: "This role cannot access appointments." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select(appointmentSelection).eq("id", appointmentId).maybeSingle();
  if (error || !data) return { data: null, share: null, error: error?.message ?? "Appointment not found." };
  const appointment = mapAppointment(data as unknown as AppointmentRow);
  const { data: shares, error: shareError } = await supabase.from("appointment_medical_shares").select("id, appointment_id, expires_at, revoked_at, created_at, appointment_medical_files(id, share_id, original_filename, mime_type, size_bytes, kind, created_at)").eq("appointment_id", appointmentId).order("created_at", { ascending: false }).limit(1);
  const rawShare = shares?.[0] as undefined | {
    id: string; appointment_id: string; expires_at: string; revoked_at: string | null; created_at: string;
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
