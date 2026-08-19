import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isSameOriginMutation, parsePushEndpoint, parsePushSubscriptionInput } from "@/lib/notifications/subscription";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = "supabase/migrations/20260819093737_implement_medication_push_reminders.sql";

function source(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

test("push subscription input accepts only bounded HTTPS capability data", () => {
  const valid = {
    endpoint: "https://push.example.test/subscription/123456789",
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
