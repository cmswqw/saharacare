"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DemoAction, DemoActionState } from "@/types";

const demoActions = new Set<DemoAction>([
  "due_now",
  "taken",
  "late",
  "missed",
  "reset",
]);

const successMessages: Record<DemoAction, string> = {
  due_now: "Metformin is due now. Open the patient dashboard to mark it as taken.",
  taken: "Metformin was marked as taken. The linked caregiver will update live.",
  late: "Vitamin D is now late. The linked caregiver will update live.",
  missed: "Blood Pressure Medicine is now missed. The linked caregiver will update live.",
  reset: "Demo data reset: 3 medications, 3 today doses, and 7 days of history are ready.",
};

function actionResult(
  status: DemoActionState["status"],
  message: string,
  action?: DemoAction,
): DemoActionState {
  return { status, message, action, nonce: Date.now() };
}

function isDemoAction(value: string): value is DemoAction {
  return demoActions.has(value as DemoAction);
}

export async function runDemoAction(
  _previousState: DemoActionState,
  formData: FormData,
): Promise<DemoActionState> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return actionResult("error", "Demo Mode is disabled for this deployment.");
  }

  const requestedAction = String(formData.get("demo_action") ?? "");
  if (!isDemoAction(requestedAction)) {
    return actionResult("error", "That demo action is not supported.");
  }

  if (
    requestedAction === "reset"
    && String(formData.get("confirm_reset") ?? "") !== "RESET_DEMO_DATA"
  ) {
    return actionResult("error", "Reset confirmation was not received.", requestedAction);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return actionResult(
      "error",
      "Your session has expired. Sign in as the demo patient and try again.",
      requestedAction,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "patient") {
    return actionResult(
      "error",
      "Demo actions are available only to the signed-in demo patient.",
      requestedAction,
    );
  }

  const { error } = await supabase.rpc("run_own_demo_action", {
    demo_action: requestedAction,
  });

  if (error) {
    if (error.code === "42501") {
      return actionResult(
        "error",
        "This patient is not enabled for database demo actions. Complete the README demo-user SQL step.",
        requestedAction,
      );
    }

    if (error.code === "PGRST202" || error.message.includes("run_own_demo_action")) {
      return actionResult(
        "error",
        "The Phase 8 migration is not available yet. Apply the new SQL in Supabase and retry.",
        requestedAction,
      );
    }

    return actionResult(
      "error",
      requestedAction === "reset"
        ? "Demo data could not be reset. No partial reset was saved; please try again."
        : "The demo state could not be updated. Reset demo data, then try again.",
      requestedAction,
    );
  }

  revalidatePath("/patient", "layout");
  revalidatePath("/caregiver", "layout");
  revalidatePath("/settings");

  return actionResult("success", successMessages[requestedAction], requestedAction);
}
