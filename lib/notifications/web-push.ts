import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MEDICATION_REMINDER_BATCH_SIZE,
  MEDICATION_REMINDER_LEAD_MINUTES,
} from "@/lib/notifications/config";
import type { Language } from "@/types";

type ClaimedReminder = {
  delivery_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  language: Language;
  sound_enabled: boolean;
};

type PushFailure = Error & { statusCode?: number };

export function buildMedicationReminderPayload(
  language: Language,
  soundEnabled: boolean,
) {
  return {
    title: "SaharaCare",
    body: language === "ne"
      ? "तपाईंको औषधि खाने समय नजिकिँदै छ। विवरण हेर्न SaharaCare खोल्नुहोस्।"
      : "It’s almost time for your medicine. Open SaharaCare to check your reminder.",
    url: "/patient",
    tag: "saharacare-medication-reminder",
    silent: !soundEnabled,
  };
}

function vapidDetails() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (
    !subject
    || (!subject.startsWith("mailto:") && !subject.startsWith("https://"))
    || !publicKey
    || !privateKey
  ) {
    throw new Error("Medication push configuration is incomplete.");
  }

  return { subject, publicKey, privateKey };
}

function pushErrorCode(error: unknown) {
  const statusCode = error instanceof Error
    ? (error as PushFailure).statusCode
    : undefined;
  return statusCode ? `push_http_${statusCode}` : "push_delivery_failed";
}

export async function dispatchMedicationReminders() {
  const admin = createAdminClient();
  const details = vapidDetails();
  const { data, error } = await admin.rpc("claim_due_medication_reminders", {
    reminder_lead_minutes: MEDICATION_REMINDER_LEAD_MINUTES,
    reminder_batch_size: MEDICATION_REMINDER_BATCH_SIZE,
  });

  if (error) throw new Error(`Medication reminder claim failed: ${error.code ?? "unknown"}`);

  const reminders = (data ?? []) as ClaimedReminder[];
  let sent = 0;
  let failed = 0;
  let expired = 0;

  for (let index = 0; index < reminders.length; index += 10) {
    const batch = reminders.slice(index, index + 10);
    await Promise.all(batch.map(async (reminder) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: reminder.endpoint,
            keys: { p256dh: reminder.p256dh, auth: reminder.auth_key },
          },
          JSON.stringify(buildMedicationReminderPayload(
            reminder.language,
            reminder.sound_enabled,
          )),
          {
            vapidDetails: details,
            TTL: 15 * 60,
            urgency: "high",
            topic: "saharacare-reminder",
            timeout: 10_000,
          },
        );

        const { error: updateError } = await admin
          .from("medication_reminder_deliveries")
          .update({
            status: "sent",
            delivered_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", reminder.delivery_id);

        if (updateError) {
          console.error(JSON.stringify({ event: "reminder_delivery_state_failed", code: updateError.code }));
        }
        sent += 1;
      } catch (sendError) {
        const statusCode = sendError instanceof Error
          ? (sendError as PushFailure).statusCode
          : undefined;
        const subscriptionExpired = statusCode === 404 || statusCode === 410;
        const nextAttemptAt = new Date(Date.now() + 2 * 60_000).toISOString();

        await admin
          .from("medication_reminder_deliveries")
          .update({
            status: "failed",
            next_attempt_at: nextAttemptAt,
            last_error: subscriptionExpired ? "push_subscription_expired" : pushErrorCode(sendError),
          })
          .eq("id", reminder.delivery_id);

        if (subscriptionExpired) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", reminder.subscription_id);
          expired += 1;
        } else {
          failed += 1;
        }
      }
    }));
  }

  return { claimed: reminders.length, sent, failed, expired };
}
