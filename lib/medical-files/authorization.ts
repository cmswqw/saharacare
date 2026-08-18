import type { AppointmentStatus, UserRole } from "@/types";

type MedicalFileAccessInput = {
  userId: string;
  role: UserRole;
  patientId: string;
  doctorId: string;
  appointmentStatus: AppointmentStatus;
  expiresAt: string;
  revokedAt: string | null;
  now?: Date;
};

export function canViewAppointmentMedicalFile(input: MedicalFileAccessInput) {
  const active = !input.revokedAt
    && input.appointmentStatus !== "cancelled"
    && new Date(input.expiresAt).getTime() > (input.now ?? new Date()).getTime();

  if (!active) return false;
  if (input.role === "patient") return input.userId === input.patientId;
  if (input.role === "doctor") return input.userId === input.doctorId;
  return false;
}

export function canManageAppointmentMedicalShare(input: Pick<MedicalFileAccessInput, "userId" | "role" | "patientId" | "appointmentStatus">) {
  return input.role === "patient"
    && input.userId === input.patientId
    && input.appointmentStatus !== "cancelled";
}
