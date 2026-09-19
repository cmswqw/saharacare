import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = resolve(projectRoot, "supabase/migrations");
const migrationName = "20260917181841_harden_appointment_notification_authorization.sql";
const migration = readFileSync(resolve(migrationDirectory, migrationName), "utf8");

test("the latest appointment notification definition is the security repair", () => {
  const definitions = readdirSync(migrationDirectory).sort().filter((name) => (
    /create(?: or replace)? function public\.notify_appointment_participants\(/iu.test(
      readFileSync(resolve(migrationDirectory, name), "utf8"),
    )
  ));
  assert.equal(definitions.at(-1), migrationName);
  assert.match(migration, /^begin;[\s\S]*commit;\s*$/iu);
  assert.match(migration, /create or replace function public\.notify_appointment_participants/iu);
});

test("notification authorization rejects NULL event actors rather than SQL UNKNOWN", () => {
  for (const actorColumn of ["created_by", "updated_by", "cancelled_by"]) {
    assert.match(migration, new RegExp(`existing\\.${actorColumn} is distinct from actor_id`, "iu"));
  }
  assert.doesNotMatch(migration, /existing\.(?:created_by|updated_by|cancelled_by)\s*<>\s*actor_id/iu);
  assert.match(migration, /actor_id is null/iu);
  assert.match(migration, /actor_role is distinct from 'caregiver'/iu);
  assert.match(migration, /account_status = 'active'/iu);
});

test("notification authorization rechecks the current accepted patient relationship", () => {
  const guard = migration.indexOf("private.current_actor_can_manage_patient_appointments(existing.patient_id) is not true");
  const insertion = migration.indexOf("insert into public.notifications");
  assert.ok(guard > 0 && guard < insertion);
  const appointments = readFileSync(resolve(
    migrationDirectory,
    "20260819222740_implement_doctor_availability_and_caregiver_appointments.sql",
  ), "utf8");
  const helper = appointments.slice(
    appointments.indexOf("create function private.current_actor_can_manage_patient_appointments("),
    appointments.indexOf("revoke all on function private.current_actor_can_manage_patient_appointments("),
  );
  assert.match(helper, /actor\.id = \(select auth\.uid\(\)\)/iu);
  assert.match(helper, /actor\.account_status = 'active'/iu);
  assert.match(helper, /links\.caregiver_id = actor\.id/iu);
  assert.match(helper, /links\.patient_id = target_patient_id/iu);
  assert.match(helper, /links\.status = 'accepted'/iu);
});

test("appointment notification events must match the persisted appointment state", () => {
  for (const event of ["booked", "rescheduled"]) {
    assert.match(migration, new RegExp(
      `appointment_event = 'appointment_${event}'[\\s\\S]*?existing\\.status not in \\('requested', 'confirmed'\\)`,
      "iu",
    ));
  }
  assert.match(migration, /appointment_event = 'appointment_cancelled'[\s\S]*?existing\.status is distinct from 'cancelled'[\s\S]*?existing\.cancelled_at is null/iu);
});

test("notification repair preserves the narrow RPC grants and all existing RLS", () => {
  assert.match(migration, /set search_path = ''/iu);
  assert.match(migration, /actor_id uuid := \(select auth\.uid\(\)\)/iu);
  assert.match(migration, /revoke all on function public\.notify_appointment_participants\(uuid, text\)\s+from public, anon, authenticated/iu);
  assert.match(migration, /grant execute on function public\.notify_appointment_participants\(uuid, text\)\s+to authenticated/iu);
  assert.doesNotMatch(migration, /disable row level security|grant all|alter table|create policy/iu);
});
