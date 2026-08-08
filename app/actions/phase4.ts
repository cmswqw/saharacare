"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Phase4ActionState, UserRole } from "@/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function actionResult(
  status: Phase4ActionState["status"],
  message: string,
): Phase4ActionState {
  return { status, message, nonce: Date.now() };
}

async function getActionActor(expectedRole?: UserRole) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, actor: null, error: "Please sign in again." };
  }

  const { data: actor, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError
    || !actor
    || (actor.role !== "patient" && actor.role !== "caregiver")
  ) {
    return { supabase, actor: null, error: "Your SaharaCare profile is unavailable." };
  }

  if (expectedRole && actor.role !== expectedRole) {
    return { supabase, actor: null, error: "This action is not available for your role." };
  }

  return {
    supabase,
    actor: { id: actor.id, role: actor.role as UserRole },
    error: null,
  };
}

function normalizeLinkingCode(value: FormDataEntryValue | null) {
  const entered = String(value ?? "").trim().toUpperCase();
  return /^[0-9A-F]{10}$/.test(entered) ? `SC-${entered}` : entered;
}

export async function requestCaregiverLinkAction(
  _previousState: Phase4ActionState,
  formData: FormData,
): Promise<Phase4ActionState> {
  const context = await getActionActor("caregiver");
  if (!context.actor) return actionResult("error", context.error ?? "Unable to continue.");

  const patientCode = normalizeLinkingCode(formData.get("patient_code"));
  if (!/^SC-[0-9A-F]{10}$/.test(patientCode)) {
    return actionResult("error", "Enter a valid SaharaCare patient code.");
  }

  const { data, error } = await context.supabase.rpc("request_caregiver_link", {
    patient_code: patientCode,
  });

  if (error) {
    return actionResult(
      "error",
      "We couldn’t use that code. Check it with the patient and try again.",
    );
  }

  revalidatePath("/caregiver");

  return actionResult(
    "success",
    data === "accepted"
      ? "You are already linked to this patient."
      : "Request sent. The patient must approve it before you can see their medicines.",
  );
}

export async function approveCaregiverLinkAction(formData: FormData) {
  const context = await getActionActor("patient");
  if (!context.actor) return;

  const linkId = String(formData.get("link_id") ?? "");
  if (!uuidPattern.test(linkId)) return;

  await context.supabase
    .from("caregiver_links")
    .update({ status: "accepted" })
    .eq("id", linkId)
    .eq("patient_id", context.actor.id)
    .eq("status", "pending");

  revalidatePath("/patient");
  revalidatePath("/caregiver");
}

export async function removeCaregiverLinkAction(formData: FormData) {
  const context = await getActionActor();
  if (!context.actor) return;

  const linkId = String(formData.get("link_id") ?? "");
  if (!uuidPattern.test(linkId)) return;

  const participantColumn = context.actor.role === "patient"
    ? "patient_id"
    : "caregiver_id";

  await context.supabase
    .from("caregiver_links")
    .delete()
    .eq("id", linkId)
    .eq(participantColumn, context.actor.id);

  revalidatePath("/patient");
  revalidatePath("/caregiver");
}

export async function saveMedicationAction(
  _previousState: Phase4ActionState,
  formData: FormData,
): Promise<Phase4ActionState> {
  const context = await getActionActor("patient");
  if (!context.actor) return actionResult("error", context.error ?? "Unable to continue.");

  const rawMedicationId = String(formData.get("medication_id") ?? "").trim();
  const medicationId = rawMedicationId === "" ? null : rawMedicationId;
  const name = String(formData.get("name") ?? "").trim();
  const dosage = String(formData.get("dosage") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const active = formData.get("active") !== "false";
  const scheduledTimes = [...new Set(
    formData.getAll("scheduled_times").map((value) => String(value).trim()),
  )].sort();
  const scheduleDays = [...new Set(
    formData
      .getAll("schedule_days")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
  )].sort((left, right) => left - right);

  if (medicationId && !uuidPattern.test(medicationId)) {
    return actionResult("error", "That medication could not be identified.");
  }
  if (!name || !dosage) {
    return actionResult("error", "Medication name and dosage are required.");
  }
  if (
    scheduledTimes.length < 1
    || scheduledTimes.length > 8
    || scheduledTimes.some((time) => !timePattern.test(time))
  ) {
    return actionResult("error", "Add between one and eight valid schedule times.");
  }
  if (scheduleDays.length < 1) {
    return actionResult("error", "Choose at least one day of the week.");
  }

  const { error } = await context.supabase.rpc("save_patient_medication", {
    medication_id: medicationId,
    medication_name: name,
    medication_dosage: dosage,
    medication_instructions: instructions,
    medication_active: active,
    scheduled_times: scheduledTimes,
    schedule_days: scheduleDays,
  });

  if (error) {
    return actionResult("error", "The medication could not be saved. Please try again.");
  }

  revalidatePath("/patient");
  revalidatePath("/patient/medicines");
  revalidatePath("/caregiver");

  return actionResult(
    "success",
    medicationId ? "Medication updated." : "Medication added.",
  );
}

export async function setMedicationActiveAction(formData: FormData) {
  const context = await getActionActor("patient");
  if (!context.actor) return;

  const medicationId = String(formData.get("medication_id") ?? "");
  const active = formData.get("active") === "true";
  if (!uuidPattern.test(medicationId)) return;

  await context.supabase
    .from("medications")
    .update({ active })
    .eq("id", medicationId)
    .eq("patient_id", context.actor.id);

  revalidatePath("/patient");
  revalidatePath("/patient/medicines");
  revalidatePath("/caregiver");
}

export async function deleteMedicationAction(formData: FormData) {
  const context = await getActionActor("patient");
  if (!context.actor) return;

  const medicationId = String(formData.get("medication_id") ?? "");
  if (!uuidPattern.test(medicationId)) return;

  await context.supabase
    .from("medications")
    .delete()
    .eq("id", medicationId)
    .eq("patient_id", context.actor.id);

  revalidatePath("/patient");
  revalidatePath("/patient/medicines");
  revalidatePath("/caregiver");
}
