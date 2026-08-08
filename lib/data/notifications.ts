import "server-only";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification, MedicationNotificationType } from "@/types";

type DataResult<T> = {
  data: T;
  error: string | null;
};

function isMedicationNotificationType(value: string): value is MedicationNotificationType {
  return value === "medication_taken"
    || value === "medication_late"
    || value === "medication_missed";
}

export async function getNotificationsForCurrentUser(): Promise<DataResult<AppNotification[]>> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, patient_id, type, title, message, read, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { data: [], error: error.message };

  return {
    data: (data ?? []).flatMap((row) => (
      isMedicationNotificationType(row.type) ? [{
        id: row.id,
        patient_id: row.patient_id,
        type: row.type,
        title: row.title,
        message: row.message,
        read: row.read,
        created_at: row.created_at,
      }] : []
    )),
    error: null,
  };
}

export async function getUnreadNotificationCount(): Promise<DataResult<number>> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("read", false);

  return {
    data: count ?? 0,
    error: error?.message ?? null,
  };
}
