"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { NotificationActionState } from "@/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function result(
  status: NotificationActionState["status"],
  message: string,
): NotificationActionState {
  return { status, message, nonce: Date.now() };
}

export async function markNotificationReadAction(
  _previousState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return result("error", "Your session has expired. Please sign in again.");
  }

  const notificationId = String(formData.get("notification_id") ?? "");
  if (!uuidPattern.test(notificationId)) {
    return result("error", "That notification could not be identified.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .select("id, read")
    .maybeSingle();

  if (error || !data?.read) {
    return result("error", "This notification could not be marked as read.");
  }

  revalidatePath("/patient", "layout");
  revalidatePath("/caregiver", "layout");
  revalidatePath("/patient/notifications");
  revalidatePath("/caregiver/notifications");
  return result("success", "Notification marked as read.");
}
