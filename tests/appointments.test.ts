import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPOINTMENT_SLOT_MINUTES,
  APPOINTMENT_TIME_ZONE,
  getKathmanduDateInputValue,
  isAppointmentDate,
  isAppointmentTime,
} from "../lib/appointment-utils";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(resolve(
  projectRoot,
  "supabase/migrations/20260819222740_implement_doctor_availability_and_caregiver_appointments.sql",
), "utf8");
const actions = readFileSync(resolve(projectRoot, "app/actions/appointments.ts"), "utf8");

test("appointment time configuration is explicit and Kathmandu-aware", () => {
  assert.equal(APPOINTMENT_SLOT_MINUTES, 30);
  assert.equal(APPOINTMENT_TIME_ZONE, "Asia/Kathmandu");
  assert.equal(
    getKathmanduDateInputValue(new Date("2026-08-21T18:30:00.000Z")),
    "2026-08-22",
  );
  assert.equal(isAppointmentDate("2026-08-22"), true);
  assert.equal(isAppointmentDate("22-08-2026"), false);
  assert.equal(isAppointmentTime("09:30"), true);
  assert.equal(isAppointmentTime("25:00"), false);
});

test("doctor availability is doctor-owned, RLS-enabled, and never raw-readable by patients", () => {
  assert.match(migration, /create table public\.doctor_availability\s*\(/i);
  assert.match(migration, /create table public\.doctor_availability_overrides\s*\(/i);
  assert.match(migration, /alter table public\.doctor_availability enable row level security/i);
  assert.match(migration, /doctor_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /revoke all on table[\s\S]*public\.doctor_availability[\s\S]*from anon, authenticated/i);
  assert.doesNotMatch(migration, /create policy[^;]+doctor_availability[^;]+to anon/i);
});

test("slot generation is deterministic, Kathmandu-aware, and removes blocked and booked time", () => {
  assert.match(migration, /create function public\.get_available_appointment_slots/i);
  assert.match(migration, /Custom availability blocks cannot overlap\./i);
  assert.match(migration, /at time zone 'Asia\/Kathmandu'/i);
  assert.match(migration, /override_type = 'custom_hours'/i);
  assert.match(migration, /override_type = 'unavailable'/i);
  assert.match(migration, /appointment_slot_has_conflict/i);
  assert.match(migration, /status <> 'cancelled'/i);
  assert.match(migration, /generate_series/i);
  assert.doesNotMatch(migration, /gemini|openai/i);
});

test("booking and rescheduling use authenticated atomic RPCs with a collision key", () => {
  assert.match(migration, /create unique index appointments_doctor_active_start_key/i);
  assert.match(migration, /where status <> 'cancelled'/i);
  assert.match(migration, /create function public\.book_appointment/i);
  assert.match(migration, /create function public\.reschedule_appointment/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /private\.current_actor_can_manage_patient_appointments\(appointment_patient_id\)/i);
  assert.match(migration, /links\.status = 'accepted'/i);
  assert.match(migration, /created_by_role/i);
  assert.match(migration, /when unique_violation then/i);
});

test("patient ownership is derived server-side and appointment actions expose no service key", () => {
  assert.match(actions, /context\.actor\.role === "patient" \? context\.actor\.id : browserPatientId/);
  assert.match(actions, /\.eq\("caregiver_id", context\.actor\.id\)/);
  assert.match(actions, /\.eq\("status", "accepted"\)/);
  assert.match(actions, /\.rpc\("book_appointment"/);
  assert.doesNotMatch(actions, /createAdminClient|SUPABASE_SECRET_KEY|service_role/);
});

test("caregivers can only read appointments through an accepted patient link", () => {
  assert.match(migration, /appointments_select_patient_doctor_or_caregiver/i);
  assert.match(migration, /private\.is_accepted_caregiver\(patient_id\)/i);
  assert.match(migration, /revoke insert, update, delete on table public\.appointments\s+from authenticated/i);
  assert.doesNotMatch(migration, /appointment_medical_(shares|files)[\s\S]+caregiver/i);
});
