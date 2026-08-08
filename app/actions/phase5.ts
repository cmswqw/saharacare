"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Phase5ActionState } from "@/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function result(
  status: Phase5ActionState["status"],
  message: string,
  takenAt?: string,
): Phase5ActionState {
  return { status, message, takenAt, nonce: Date.now() };
}

export async function markDoseAsTakenAction(
  _previousState: Phase5ActionState,
  formData: FormData,
): Promise<Phase5ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return result("error", "Your session has expired. Please sign in again.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "patient") {
    return result("error", "Only the patient can mark this dose as taken.");
  }

  const doseId = String(formData.get("dose_id") ?? "");
  if (!uuidPattern.test(doseId)) {
    return result("error", "That dose could not be identified.");
  }

  const { error: evaluationError } = await supabase.rpc("evaluate_own_due_doses");
  if (evaluationError) {
    return result(
      "error",
      "Dose status could not be evaluated. Refresh the page and try again.",
    );
  }

  const { data, error } = await supabase.rpc("mark_dose_as_taken", {
    target_dose_id: doseId,
  });

  if (error || !data || data.status !== "taken" || !data.taken_at) {
    return result(
      "error",
      "The dose could not be updated. Refresh the page and try again.",
    );
  }

  revalidatePath("/patient");
  revalidatePath("/caregiver", "layout");

  return result("success", "Dose marked as taken.", data.taken_at);
}
