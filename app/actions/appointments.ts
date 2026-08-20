"use server";

import { revalidatePath } from "next/cache";
import {
  isAppointmentDate,
  isAppointmentTime,
  isAppointmentUuid,
} from "@/lib/appointment-utils";
import { createClient } from "@/lib/supabase/server";
import type {
  AvailableAppointmentSlot,
  UserRole,
} from "@/types";

export type AppointmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  appointmentId?: string;
  nonce?: number;
};

export type AvailableSlotsState = {
  slots: AvailableAppointmentSlot[];
  error: string | null;
};

type ActionActor = {
  id: string;
  role: UserRole;
};

type AuthenticatedActionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actor: ActionActor;
};

type AppointmentBookingInput = {
  patientId: string;
  doctorId: string;
  startsAt: string;
  facility: string;
  purpose: string;
  note: string | null;
};

const idleError = "The appointment could not be updated. Please try again.";

function result(
  status: AppointmentActionState["status"],
  message: string,
  appointmentId?: string,
): AppointmentActionState {
  return { status, message, appointmentId, nonce: Date.now() };
}

async function getActionActor(allowedRoles: UserRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { supabase, actor: null, error: "Please sign in again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profileError
    || !profile
    || profile.account_status !== "active"
    || !allowedRoles.includes(profile.role as UserRole)
  ) {
    return { supabase, actor: null, error: "This action is not available for your account." };
  }

  return {
    supabase,
    actor: { id: profile.id, role: profile.role as UserRole } satisfies ActionActor,
    error: null,
  };
}

async function resolveBookingPatientId(
  context: AuthenticatedActionContext,
  requestedPatientId: string,
) {
  if (context.actor.role === "patient") {
    return { patientId: context.actor.id, error: null };
  }

  if (context.actor.role !== "caregiver" || !isAppointmentUuid(requestedPatientId)) {
    return { patientId: null, error: "Choose an approved linked patient." };
  }

  const { data: link, error } = await context.supabase
    .from("caregiver_links")
    .select("id")
    .eq("caregiver_id", context.actor.id)
    .eq("patient_id", requestedPatientId)
    .eq("status", "accepted")
    .maybeSingle();

  if (error || !link) {
    return { patientId: null, error: "You can only book for an approved linked patient." };
  }

  return { patientId: requestedPatientId, error: null };
}

async function createAppointmentForActor(
  context: AuthenticatedActionContext,
  input: AppointmentBookingInput,
) {
  // The RPC derives created_by, created_by_role, and updated_by from auth.uid()
  // and the verified profile. Actor audit fields are never accepted from FormData.
  return context.supabase.rpc("book_appointment", {
    appointment_patient_id: input.patientId,
    appointment_doctor_id: input.doctorId,
    appointment_starts_at: input.startsAt,
    appointment_facility: input.facility,
    appointment_purpose: input.purpose,
    appointment_note: input.note,
  });
}

function appointmentError(error: { code?: string; message?: string }) {
  if (error.code === "23P01" || error.code === "23505") {
    return "That time is no longer available. Choose another free slot.";
  }
  if (error.code === "42501") {
    return "Your account is not authorized to manage this appointment.";
  }
  if (error.code === "22023" && error.message) {
    return error.message;
  }
  if (error.code === "PGRST202") {
    return "The appointment database migration has not been applied yet.";
  }
  return idleError;
}

function logMutationError(event: string, error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  console.error(event, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

function revalidateAppointmentPaths() {
  revalidatePath("/patient/appointments");
  revalidatePath("/doctor");
  revalidatePath("/doctor/availability");
  revalidatePath("/caregiver", "layout");
}

async function notifyPatientAfterCaregiverAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actor: ActionActor,
  appointmentId: string,
  event: "appointment_booked" | "appointment_rescheduled" | "appointment_cancelled",
) {
  if (actor.role !== "caregiver") return;
  const { error } = await supabase.rpc("notify_appointment_participants", {
    target_appointment_id: appointmentId,
    appointment_event: event,
  });
  if (error) logMutationError("appointment_notification_failed", error);
  else revalidatePath("/patient/notifications");
}

export async function getAvailableAppointmentSlotsAction(
  doctorId: string,
  date: string,
): Promise<AvailableSlotsState> {
  const context = await getActionActor(["patient", "caregiver", "doctor"]);
  if (!context.actor) return { slots: [], error: context.error ?? idleError };
  if (!isAppointmentUuid(doctorId) || !isAppointmentDate(date)) {
    return { slots: [], error: "Choose a doctor and date." };
  }

  const { data, error } = await context.supabase.rpc("get_available_appointment_slots", {
    target_doctor_id: doctorId,
    appointment_date: date,
  });
  if (error) {
    logMutationError("appointment_slots_failed", error);
    return { slots: [], error: appointmentError(error) };
  }

  const slots = (data ?? []).flatMap((slot: Record<string, unknown>) => (
    typeof slot.starts_at === "string" && typeof slot.ends_at === "string"
      ? [{ starts_at: slot.starts_at, ends_at: slot.ends_at }]
      : []
  ));
  return { slots, error: null };
}

export async function bookAppointmentAction(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const context = await getActionActor(["patient", "caregiver"]);
  if (!context.actor) return result("error", context.error ?? idleError);
  const actorContext: AuthenticatedActionContext = {
    supabase: context.supabase,
    actor: context.actor,
  };

  const doctorId = String(formData.get("doctorId") ?? "");
  const requestedPatientId = String(formData.get("patientId") ?? "");
  const bookingPatient = await resolveBookingPatientId(
    actorContext,
    requestedPatientId,
  );
  if (!bookingPatient.patientId) {
    return result("error", bookingPatient.error ?? idleError);
  }
  const patientId = bookingPatient.patientId;
  const startsAt = String(formData.get("startsAt") ?? "");
  const facility = String(formData.get("facility") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (
    !isAppointmentUuid(doctorId)
    || !isAppointmentUuid(patientId)
    || !Number.isFinite(Date.parse(startsAt))
    || !facility
    || facility.length > 200
    || !purpose
    || purpose.length > 500
    || note.length > 2000
  ) {
    return result("error", "Choose a patient, doctor, free time, clinic, and reason.");
  }

  const { data, error } = await createAppointmentForActor(
    actorContext,
    {
      patientId,
      doctorId,
      startsAt,
      facility,
      purpose,
      note: note || null,
    },
  );
  if (error) {
    logMutationError("book_appointment_failed", error);
    return result("error", appointmentError(error));
  }
  if (typeof data !== "string" || !isAppointmentUuid(data)) {
    return result("error", "Supabase did not confirm the appointment.");
  }

  await notifyPatientAfterCaregiverAction(
    actorContext.supabase,
    actorContext.actor,
    data,
    "appointment_booked",
  );
  revalidateAppointmentPaths();
  return result("success", "Appointment booked successfully.", data);
}

export async function requestAppointmentAction(
  previousState: AppointmentActionState,
  formData: FormData,
) {
  return bookAppointmentAction(previousState, formData);
}

export async function rescheduleAppointmentAction(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const context = await getActionActor(["patient", "caregiver"]);
  if (!context.actor) return result("error", context.error ?? idleError);

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  if (!isAppointmentUuid(appointmentId) || !Number.isFinite(Date.parse(startsAt))) {
    return result("error", "Choose a valid free time.");
  }

  const { data, error } = await context.supabase.rpc("reschedule_appointment", {
    target_appointment_id: appointmentId,
    replacement_starts_at: startsAt,
  });
  if (error) {
    logMutationError("reschedule_appointment_failed", error);
    return result("error", appointmentError(error));
  }

  const confirmedAppointmentId = typeof data === "string" ? data : appointmentId;
  await notifyPatientAfterCaregiverAction(
    context.supabase,
    context.actor,
    confirmedAppointmentId,
    "appointment_rescheduled",
  );
  revalidateAppointmentPaths();
  return result("success", "Appointment rescheduled.", confirmedAppointmentId);
}

export async function cancelAppointmentAction(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const context = await getActionActor(["patient", "caregiver"]);
  if (!context.actor) return result("error", context.error ?? idleError);

  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!isAppointmentUuid(appointmentId)) {
    return result("error", "That appointment could not be identified.");
  }

  const { error } = await context.supabase.rpc("cancel_appointment", {
    target_appointment_id: appointmentId,
  });
  if (error) {
    logMutationError("cancel_appointment_failed", error);
    return result("error", appointmentError(error));
  }

  await notifyPatientAfterCaregiverAction(
    context.supabase,
    context.actor,
    appointmentId,
    "appointment_cancelled",
  );
  revalidateAppointmentPaths();
  return result("success", "Appointment cancelled.", appointmentId);
}

export async function saveDoctorAvailabilityAction(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const context = await getActionActor(["doctor"]);
  if (!context.actor) return result("error", context.error ?? idleError);

  const availabilityId = String(formData.get("availabilityId") ?? "");
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  if (
    (availabilityId && !isAppointmentUuid(availabilityId))
    || !Number.isInteger(dayOfWeek)
    || dayOfWeek < 0
    || dayOfWeek > 6
    || !isAppointmentTime(startTime)
    || !isAppointmentTime(endTime)
    || startTime >= endTime
  ) {
    return result("error", "Choose a valid weekday, start time, and end time.");
  }

  const values = {
    doctor_id: context.actor.id,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  };
  const mutation = availabilityId
    ? context.supabase
        .from("doctor_availability")
        .update(values)
        .eq("id", availabilityId)
        .eq("doctor_id", context.actor.id)
        .select("id")
        .maybeSingle()
    : context.supabase
        .from("doctor_availability")
        .insert(values)
        .select("id")
        .single();
  const { data, error } = await mutation;
  if (error || !data) {
    if (error) logMutationError("save_doctor_availability_failed", error);
    return result(
      "error",
      error?.code === "23P01"
        ? "Availability blocks cannot overlap."
        : "The availability block could not be saved.",
    );
  }

  revalidatePath("/doctor/availability");
  return result("success", "Availability saved.");
}

export async function deleteDoctorAvailabilityAction(formData: FormData) {
  const context = await getActionActor(["doctor"]);
  if (!context.actor) return;
  const availabilityId = String(formData.get("availabilityId") ?? "");
  if (!isAppointmentUuid(availabilityId)) return;

  await context.supabase
    .from("doctor_availability")
    .delete()
    .eq("id", availabilityId)
    .eq("doctor_id", context.actor.id);
  revalidatePath("/doctor/availability");
}

export async function saveDoctorOverrideAction(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const context = await getActionActor(["doctor"]);
  if (!context.actor) return result("error", context.error ?? idleError);

  const overrideId = String(formData.get("overrideId") ?? "");
  const date = String(formData.get("date") ?? "");
  const overrideType = String(formData.get("overrideType") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const fullDayUnavailable = overrideType === "unavailable" && !startTime && !endTime;
  if (
    (overrideId && !isAppointmentUuid(overrideId))
    || !isAppointmentDate(date)
    || (overrideType !== "unavailable" && overrideType !== "custom_hours")
    || (!fullDayUnavailable && (
      !isAppointmentTime(startTime)
      || !isAppointmentTime(endTime)
      || startTime >= endTime
    ))
  ) {
    return result("error", "Choose a valid date and time range.");
  }

  const values = {
    doctor_id: context.actor.id,
    override_date: date,
    override_type: overrideType,
    start_time: fullDayUnavailable ? null : startTime,
    end_time: fullDayUnavailable ? null : endTime,
  };
  const mutation = overrideId
    ? context.supabase
        .from("doctor_availability_overrides")
        .update(values)
        .eq("id", overrideId)
        .eq("doctor_id", context.actor.id)
        .select("id")
        .maybeSingle()
    : context.supabase
        .from("doctor_availability_overrides")
        .insert(values)
        .select("id")
        .single();
  const { data, error } = await mutation;
  if (error || !data) {
    if (error) logMutationError("save_doctor_override_failed", error);
    return result("error", "The calendar exception could not be saved.");
  }

  revalidatePath("/doctor/availability");
  return result("success", "Calendar exception saved.");
}

export async function deleteDoctorOverrideAction(formData: FormData) {
  const context = await getActionActor(["doctor"]);
  if (!context.actor) return;
  const overrideId = String(formData.get("overrideId") ?? "");
  if (!isAppointmentUuid(overrideId)) return;

  await context.supabase
    .from("doctor_availability_overrides")
    .delete()
    .eq("id", overrideId)
    .eq("doctor_id", context.actor.id);
  revalidatePath("/doctor/availability");
}
