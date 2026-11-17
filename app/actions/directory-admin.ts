"use server";

import { revalidatePath } from "next/cache";
import { getActiveDirectoryAdminClient } from "@/lib/data/directory-admin";
import { isAppointmentUuid } from "@/lib/appointment-utils";
import { directoryNepalDateTime, type DirectoryAdminActionState } from "@/lib/directory/admin-contracts";

export async function manageDirectoryAction(_state: DirectoryAdminActionState, form: FormData): Promise<DirectoryAdminActionState> {
  const supabase = await getActiveDirectoryAdminClient();
  if (!supabase) return { status: "error" };
  const value = (name: string) => String(form.get(name) ?? "").trim();
  const operation = value("operation");
  const id = value("id"); const reason = value("reason");
  if (!isAppointmentUuid(id) || !reason || reason.length > 1000) return { status: "error" };
  let payload: Record<string, unknown> = { id, reason };
  if (operation === "provider") payload = { ...payload,
    active: form.get("active") === "on", approval_status: value("approval_status"),
    verification_status: value("verification_status"), publication_status: value("publication_status"),
    verification_reference: value("verification_reference"),
  };
  else if (operation === "affiliation") payload = { ...payload, active: form.get("active") === "on", approval_status: value("approval_status") };
  else if (operation === "record_payment") {
    const startsAt = directoryNepalDateTime(value("starts_at")); const endsAt = directoryNepalDateTime(value("ends_at"));
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return { status: "error" };
    payload = { ...payload, plan: value("plan"), payment_reference: value("payment_reference"), starts_at: startsAt, ends_at: endsAt };
  } else if (operation !== "revoke_entitlement") return { status: "error" };
  // The database rechecks active admin status and derives the audit actor.
  const { data, error } = await supabase.rpc("manage_directory_listing", { requested_operation: operation, payload });
  if (error || typeof data !== "string") return { status: "error" };
  revalidatePath("/admin");
  return { status: "success" };
}
