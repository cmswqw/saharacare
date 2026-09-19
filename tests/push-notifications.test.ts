import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isAllowedPushEndpoint, isSameOriginMutation, parsePushEndpoint, parsePushSubscriptionInput } from "@/lib/notifications/subscription";
import { loadServerModule } from "./server-module";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = "supabase/migrations/20260819093737_implement_medication_push_reminders.sql";

function source(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

test("push subscription input accepts only bounded HTTPS capability data", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-subscription",
    keys: { p256dh: "p".repeat(65), auth: "a".repeat(16) },
    language: "ne",
    soundEnabled: false,
  };

  assert.deepEqual(parsePushSubscriptionInput(valid), valid);
  assert.equal(parsePushSubscriptionInput({ ...valid, endpoint: "http://push.example.test/subscription/123456789" }), null);
  assert.equal(parsePushSubscriptionInput({ ...valid, language: "fr" }), null);
  assert.equal(parsePushSubscriptionInput({ ...valid, keys: { p256dh: "short", auth: "short" } }), null);
  assert.equal(parsePushEndpoint({ endpoint: valid.endpoint }), valid.endpoint);
  assert.equal(parsePushEndpoint({ endpoint: "javascript:alert(1)" }), null);
});

test("push requests are restricted to browser push services, not arbitrary HTTPS targets", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/wp/synthetic",
    "https://updates.push.services.mozilla.com/wpush/v2/synthetic",
    "https://web.push.apple.com/synthetic",
    "https://sin.notify.windows.com/?token=synthetic",
  ]) assert.equal(isAllowedPushEndpoint(endpoint), true, endpoint);

  for (const endpoint of [
    "https://127.0.0.1/private",
    "https://[::1]/private",
    "https://169.254.169.254/metadata",
    "https://10.0.0.1/private",
    "https://localhost/private",
    "https://attacker.example/notification",
    "https://fcm.googleapis.com.attacker.example/push",
    "https://evilnotify.windows.com/push",
    "https://fcm.googleapis.com@attacker.example/push",
    "https://user:password@fcm.googleapis.com/push",
    "https://fcm.googleapis.com:8443/push",
    "https://fcm.googleapis.com/push#fragment",
    "http://fcm.googleapis.com/push",
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
    assert.equal(parsePushEndpoint({ endpoint }), null, endpoint);
    assert.equal(parsePushSubscriptionInput({
      endpoint,
      keys: { p256dh: "p".repeat(65), auth: "a".repeat(16) },
      language: "en",
      soundEnabled: true,
    }), null, endpoint);
  }
});

test("delivery rechecks legacy endpoints before invoking any push network client", async () => {
  let sends = 0;
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const admin = {
    async rpc() {
      return { data: [{
        delivery_id: "delivery", subscription_id: "subscription",
        endpoint: "https://127.0.0.1/private", p256dh: "synthetic", auth_key: "synthetic",
        language: "en", sound_enabled: false,
      }], error: null };
    },
    from(table: string) {
      return { update(values: Record<string, unknown>) {
        updates.push({ table, values });
        return { async eq() { return { error: null }; } };
      } };
    },
  };
  const module = loadServerModule("lib/notifications/web-push.ts", {
    "web-push": { async sendNotification() { sends += 1; } },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
  }, {
    VAPID_SUBJECT: "mailto:synthetic@example.invalid",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "synthetic-public-key",
    VAPID_PRIVATE_KEY: "synthetic-private-key",
  });
  const dispatch = module.dispatchMedicationReminders as () => Promise<{ claimed: number; failed: number }>;
  const result = await dispatch();
  assert.equal(sends, 0);
  assert.equal(result.failed, 1);
  assert.equal(updates[0].table, "push_subscriptions");
  assert.equal(typeof updates[0].values.disabled_at, "string");
  assert.equal(updates[1].values.last_error, "push_endpoint_not_allowed");
});

test("push subscription mutations require the browser origin to match the public request host", () => {
  assert.equal(isSameOriginMutation(new Request("http://localhost:3011/api/push-subscriptions", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3011", host: "127.0.0.1:3011" },
  })), true);
  assert.equal(isSameOriginMutation(new Request("https://internal.example/api/push-subscriptions", {
    method: "POST",
    headers: { origin: "https://care.example", "x-forwarded-host": "care.example", "x-forwarded-proto": "https" },
  })), true);
  assert.equal(isSameOriginMutation(new Request("https://care.example/api/push-subscriptions", {
    method: "POST",
    headers: { origin: "https://evil.example" },
  })), false);
  assert.equal(isSameOriginMutation(new Request("https://care.example/api/push-subscriptions", { method: "POST" })), false);
});

test("subscription API authenticates the active patient and derives user_id server-side", () => {
  const route = source("app/api/push-subscriptions/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /profile\?\.role !== "patient"/);
  assert.match(route, /profile\.account_status !== "active"/);
  assert.match(route, /user_id: patient\.userId/);
  assert.match(route, /isSameOriginMutation\(request\)/);
  assert.doesNotMatch(route, /input\.user_id|candidate\.user_id/);
  assert.doesNotMatch(route, /NextResponse\.json\(\{[^\n]*(endpoint|p256dh|auth_key)/);
});

test("reminder storage is RLS-enabled and available only to service_role", () => {
  const migration = source(migrationPath);
  for (const table of ["push_subscriptions", "medication_reminder_deliveries"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role`, "i"));
    assert.match(migration, new RegExp(`grant select, insert, update, delete on table public\\.${table}[\\s\\S]*?to service_role`, "i"));
  }
  assert.doesNotMatch(migration, /grant all|disable row level security/i);
  assert.match(migration, /unique \(dose_record_id, push_subscription_id\)/i);
});

test("reminder claiming is Kathmandu-aware, bounded, atomic, and duplicate-safe", () => {
  const migration = source(migrationPath);
  assert.match(migration, /at time zone 'Asia\/Kathmandu'/);
  assert.match(migration, /extract\(dow from local_today\)::smallint = any\(schedule\.days_of_week\)/);
  assert.match(migration, /schedule\.start_date is null or schedule\.start_date <= local_today/);
  assert.match(migration, /schedule\.end_date is null or schedule\.end_date >= local_today/);
  assert.match(migration, /medication\.active/);
  assert.match(migration, /patient\.account_status = 'active'/);
  assert.match(migration, /on conflict \(schedule_id, scheduled_at\) do nothing/);
  assert.match(migration, /for update of delivery skip locked/);
  assert.match(migration, /attempt_count < 3/);
  assert.match(migration, /revoke all on function public\.claim_due_medication_reminders[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claim_due_medication_reminders[\s\S]*to service_role/);
});

test("push payload and service worker are private and never mutate dose state", () => {
  const sender = source("lib/notifications/web-push.ts");
  const worker = source("public/sw.js");
  assert.match(sender, /Open SaharaCare to check your reminder/);
  assert.doesNotMatch(sender, /medication\.name|dosage|instructions|patient_id/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
  assert.match(worker, /"\/patient"/);
  assert.doesNotMatch(worker, /mark.*taken|dose_records|\/api\/dose/i);
});

test("dashboard polish uses real dose and caregiver data without fake activity", () => {
  const dashboard = source("components/patient/PatientDashboard.tsx");
  const sections = source("components/patient/PatientDashboardSections.tsx");
  const provider = source("components/providers/AppProvider.tsx");
  assert.match(sections, /countDoseStatuses\(doses\)/);
  assert.match(sections, /links\.filter\(\(link\) => link\.status === "accepted"\)/);
  assert.doesNotMatch(dashboard, /ContactsSection|Recent Activity|activities/);
  assert.doesNotMatch(provider, /activityAppointmentRequested|activityReminderDelayed/);
});
