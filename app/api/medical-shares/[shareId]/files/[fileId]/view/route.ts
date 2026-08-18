import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canViewAppointmentMedicalFile } from "@/lib/medical-files/authorization";
import { MEDICAL_FILE_BUCKET } from "@/lib/medical-files/config";
import type { AppointmentStatus, UserRole } from "@/types";

export const runtime = "nodejs";

function denied(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(_: Request, context: { params: Promise<{ shareId: string; fileId: string }> }) {
  const { shareId, fileId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return denied("Sign in to view this document.", 401);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "patient" && profile.role !== "doctor")) return denied("This document is not available to your account.", 403);

  try {
    const admin = createAdminClient();
    const { data: file } = await admin.from("appointment_medical_files").select("id, share_id, storage_reference, original_filename, mime_type, content_sha256, upload_status").eq("id", fileId).eq("share_id", shareId).maybeSingle();
    if (!file || file.upload_status !== "ready") return denied("The document was not found.", 404);
    const { data: share } = await admin.from("appointment_medical_shares").select("appointment_id, expires_at, revoked_at").eq("id", shareId).maybeSingle();
    if (!share) return denied("The document was not found.", 404);
    const { data: appointment } = await admin.from("appointments").select("patient_id, doctor_id, status").eq("id", share.appointment_id).maybeSingle();
    if (!appointment || !canViewAppointmentMedicalFile({ userId: user.id, role: profile.role as UserRole, patientId: appointment.patient_id, doctorId: appointment.doctor_id, appointmentStatus: appointment.status as AppointmentStatus, expiresAt: share.expires_at, revokedAt: share.revoked_at })) return denied("This temporary document is expired, revoked, cancelled, or not assigned to you.", 403);

    const { data: object, error: objectError } = await admin.storage.from(MEDICAL_FILE_BUCKET).download(file.storage_reference);
    if (objectError || !object) return denied("The document is temporarily unavailable.", 404);
    const bytes = new Uint8Array(await object.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== file.content_sha256) return denied("The document failed its integrity check.", 409);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": file.mime_type,
        "Content-Disposition": "inline; filename=medical-document",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return denied("The document is temporarily unavailable.", 503);
  }
}
