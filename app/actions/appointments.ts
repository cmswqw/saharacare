"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppointmentActionState = { status: "idle" | "success" | "error"; message: string; appointmentId?: string };

export async function requestAppointmentAction(_: AppointmentActionState, formData: FormData): Promise<AppointmentActionState> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error", message: "Sign in as a patient before requesting an appointment." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "patient") return { status: "error", message: "Only patients can request appointments." };

  const doctorId = String(formData.get("doctorId") ?? "");
  const facility = String(formData.get("facility") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!doctorId || !facility || !purpose || !/^\d{4}-\d{2}-\d{2}$/u.test(date) || !/^\d{2}:\d{2}$/u.test(time)) return { status: "error", message: "Choose a doctor, facility, reason, date, and time." };

  const startsAt = new Date(`${date}T${time}:00+05:45`);
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) return { status: "error", message: "Choose an appointment time in the future." };
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  const { data: doctor } = await supabase.from("profiles").select("id, role").eq("id", doctorId).eq("role", "doctor").maybeSingle();
  if (!doctor) return { status: "error", message: "The selected doctor is no longer available." };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("appointments").insert({
      patient_id: user.id,
      doctor_id: doctorId,
      facility,
      purpose,
      note: note || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "requested",
    }).select("id").single();
    if (error) return { status: "error", message: `The appointment could not be requested: ${error.message}` };
    revalidatePath("/patient/appointments");
    revalidatePath("/doctor");
    return { status: "success", message: "Your appointment request has been sent.", appointmentId: data.id };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The appointment could not be requested." };
  }
}
