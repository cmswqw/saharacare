import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageAppointmentMedicalShare } from "@/lib/medical-files/authorization";
import type { AppointmentStatus } from "@/types";

export async function DELETE(_: Request, context: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in before revoking a share." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "patient") return NextResponse.json({ ok: false, message: "Only the patient can revoke this share." }, { status: 403 });

  try {
    const admin = createAdminClient();
    const { data: share } = await admin.from("appointment_medical_shares").select("id, appointment_id, revoked_at").eq("id", shareId).maybeSingle();
    if (!share) return NextResponse.json({ ok: false, message: "The share was not found." }, { status: 404 });
    const { data: appointment } = await admin.from("appointments").select("patient_id, status").eq("id", share.appointment_id).maybeSingle();
    if (!appointment || !canManageAppointmentMedicalShare({ userId: user.id, role: "patient", patientId: appointment.patient_id, appointmentStatus: appointment.status as AppointmentStatus })) return NextResponse.json({ ok: false, message: "You cannot revoke this share." }, { status: 403 });
    if (!share.revoked_at) await admin.from("appointment_medical_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "The share could not be revoked." }, { status: 500 });
  }
}
