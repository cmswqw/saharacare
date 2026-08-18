import test from "node:test";
import assert from "node:assert/strict";
import { canManageAppointmentMedicalShare, canViewAppointmentMedicalFile } from "@/lib/medical-files/authorization";
import { detectMedicalFileType, sanitizeMedicalFilename } from "@/lib/medical-files/validation";

test("medical upload validation recognizes only accepted magic bytes", () => {
  assert.equal(detectMedicalFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), "application/pdf");
  assert.equal(detectMedicalFileType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectMedicalFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectMedicalFileType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectMedicalFileType(new TextEncoder().encode("<script>not a medical file</script>")), null);
});

test("medical filenames cannot inject storage paths", () => {
  assert.equal(sanitizeMedicalFilename("../private\\record.pdf"), "private_record.pdf");
  assert.equal(sanitizeMedicalFilename("\u0000"), "medical-document");
});

test("only the patient can manage their own non-cancelled appointment share", () => {
  assert.equal(canManageAppointmentMedicalShare({ userId: "patient-a", role: "patient", patientId: "patient-a", appointmentStatus: "confirmed" }), true);
  assert.equal(canManageAppointmentMedicalShare({ userId: "patient-b", role: "patient", patientId: "patient-a", appointmentStatus: "confirmed" }), false);
  assert.equal(canManageAppointmentMedicalShare({ userId: "patient-a", role: "patient", patientId: "patient-a", appointmentStatus: "cancelled" }), false);
  assert.equal(canManageAppointmentMedicalShare({ userId: "doctor-a", role: "doctor", patientId: "patient-a", appointmentStatus: "confirmed" }), false);
});

test("file view is assigned-participant only and fails closed on expiry, revocation, or cancellation", () => {
  const base = {
    patientId: "patient-a",
    doctorId: "doctor-a",
    appointmentStatus: "confirmed" as const,
    expiresAt: "2026-08-17T12:00:00.000Z",
    revokedAt: null,
    now: new Date("2026-08-17T11:00:00.000Z"),
  };
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "patient-a", role: "patient" }), true);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor" }), true);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-b", role: "doctor" }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "caregiver-a", role: "caregiver" }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor", now: new Date("2026-08-17T12:00:00.000Z") }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor", revokedAt: "2026-08-17T11:30:00.000Z" }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor", appointmentStatus: "cancelled" }), false);
});
