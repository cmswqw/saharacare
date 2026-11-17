import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseBookingReview, parseDirectoryBookingQuote } from "../lib/directory/booking";
import type { AppointmentActionState } from "../app/actions/appointments";
import { loadServerModule } from "./server-module";
import { isAppointmentInstant } from "../lib/appointment-utils";

const patient = "11111111-1111-4111-8111-111111111111";
const doctor = "22222222-2222-4222-8222-222222222222";
const caregiver = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const quote = { providerId: id, affiliationId: id, specialtyId: "general-medicine", doctorId: doctor, facilityId: id,
  providerName: "Synthetic listed doctor", facilityName: "Synthetic Hospital", feeAmount: 500, currency: "NPR", timeZone: "Asia/Kathmandu" };
const { doctorId: _doctorId, ...reviewQuote } = quote;
const review = { ...reviewQuote, requestId: id, confirmed: true };
const start = "2030-01-01T03:15:00Z";
const slot = { starts_at: start, ends_at: "2030-01-01T03:45:00Z" };

function harness() {
  const config = { signedIn: true, role: "patient", active: true, linked: true,
    error: null as { code: string; message: string } | null,
    result: { appointment_id: id, status: "requested", replayed: false } as unknown,
    quote: quote as unknown,
  };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const logs: unknown[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: config.signedIn ? { id: config.role === "caregiver" ? caregiver : patient } : null }, error: null }) },
    from(table: string) {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => table === "profiles"
        ? { data: { id: config.role === "caregiver" ? caregiver : patient, role: config.role, account_status: config.active ? "active" : "inactive" }, error: null }
        : { data: config.linked ? { id, patient_id: patient } : null, error: null } };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: name === "get_directory_booking_slots" ? { quote: config.quote, slots: [slot] } : config.result, error: config.error };
    },
  };
  const module = loadServerModule("app/actions/appointments.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
    "next/cache": { revalidatePath: () => {} },
    "test:console": { error: (...args: unknown[]) => logs.push(args) },
  });
  const form = () => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ doctorId: doctor, patientId: doctor, startsAt: start, facility: quote.facilityName, purpose: "Checkup", bookingReview: JSON.stringify(review), created_by: "ATTACKER", created_by_role: "admin" })) data.set(key, value);
    return data;
  };
  const book = module.bookAppointmentAction as (previous: AppointmentActionState, input: FormData) => Promise<AppointmentActionState>;
  const slots = module.getDirectoryBookingSlotsAction as (selection: unknown, date: string, patientId?: string) => Promise<{ quote: unknown; slots: unknown[]; error: string | null }>;
  return { config, calls, logs, form, book, slots };
}

test("booking quote/review preserves unknown/zero fees, timezone and exact allowed review fields", () => {
  assert.equal(isAppointmentInstant("2030-01-01T09:00:00+05:45"), true);
  assert.equal(isAppointmentInstant(start), true);
  assert.equal(isAppointmentInstant("2030-01-01T09:00:00"), false);
  assert.deepEqual(parseDirectoryBookingQuote(quote), quote);
  assert.equal(parseDirectoryBookingQuote({ ...quote, feeAmount: null, currency: null })?.feeAmount, null);
  assert.equal(parseDirectoryBookingQuote({ ...quote, feeAmount: 0 })?.feeAmount, 0);
  for (const invalid of [{ ...quote, feeAmount: NaN }, { ...quote, currency: null }, { ...quote, timeZone: "UTC" }, { ...quote, facilityId: "fake" }]) assert.equal(parseDirectoryBookingQuote(invalid), null);
  assert.deepEqual(parseBookingReview(review), review);
  for (const invalid of [{ ...review, confirmed: false }, { ...review, created_by: patient }, { ...review, feeAmount: "500" }, { ...review, requestId: "fake" }]) assert.equal(parseBookingReview(invalid), null);
});

test("patient action derives own identity, reuses book RPC with explicit review and returns actual persisted status", async () => {
  const { config, calls, book, form } = harness();
  const result = await book({ status: "idle", message: "" }, form());
  assert.equal(result.status, "success"); assert.equal(result.appointmentId, id); assert.equal(result.appointmentStatus, "requested");
  assert.equal(calls.length, 1); assert.equal(calls[0].name, "book_appointment"); assert.equal(calls[0].args.appointment_patient_id, patient);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.booking_review)), review);
  assert.ok(!JSON.stringify(calls[0].args).includes("ATTACKER"));
  for (const status of ["confirmed", "completed", "cancelled"]) {
    config.result = { appointment_id: id, status, replayed: true };
    assert.equal((await book({ status: "idle", message: "" }, form())).appointmentStatus, status);
  }
  config.result = { appointment_id: "fake", status: "confirmed" };
  assert.equal((await book({ status: "idle", message: "" }, form())).status, "error");
});

test("caregiver action requires accepted link and suppresses duplicate notifications on replay", async () => {
  const { config, calls, book, form } = harness(); config.role = "caregiver";
  const input = form(); input.set("patientId", patient);
  config.linked = false; assert.equal((await book({ status: "idle", message: "" }, input)).status, "error"); assert.equal(calls.length, 0);
  config.linked = true; config.result = { appointment_id: id, status: "requested", replayed: true };
  assert.equal((await book({ status: "idle", message: "" }, input)).status, "success"); assert.equal(calls.length, 1);
  assert.equal(calls[0].args.appointment_patient_id, patient);
  config.signedIn = false; assert.equal((await book({ status: "idle", message: "" }, input)).status, "error");
});

test("stale listing and collision errors have safe refresh codes, malformed reviews never mutate", async () => {
  const { config, calls, logs, book, form } = harness();
  for (const [code, expected] of [["P0001", "stale"], ["23P01", "conflict"], ["23505", "conflict"]]) {
    config.error = { code, message: "PRIVATE PATIENT TEXT" };
    const result = await book({ status: "idle", message: "" }, form()); assert.equal(result.status, "error"); assert.equal(result.errorCode, expected); assert.ok(result.nonce);
  }
  assert.ok(!JSON.stringify(logs).includes("PRIVATE"));
  const before = calls.length; const invalid = form(); invalid.set("bookingReview", JSON.stringify({ ...review, confirmed: false }));
  assert.equal((await book({ status: "idle", message: "" }, invalid)).errorCode, "invalid"); assert.equal(calls.length, before);
});

test("slot action authenticates subject, uses shared authoritative quote and rejects malformed/cross-listing data", async () => {
  const { config, calls, slots } = harness();
  const selection = { providerId: id, affiliationId: id, specialtyId: "general-medicine" };
  const result = await slots(selection, "2030-01-01", doctor); assert.equal(result.error, null); assert.equal(result.slots.length, 1);
  assert.equal(calls[0].args.requested_patient_id, patient); assert.equal(calls[0].name, "get_directory_booking_slots");
  config.quote = { ...quote, providerId: doctor }; assert.ok((await slots(selection, "2030-01-01")).error);
  assert.ok((await slots(null, "2030-01-01")).error);
  config.role = "caregiver"; config.linked = false; assert.ok((await slots(selection, "2030-01-01", patient)).error);
  config.role = "patient"; config.active = false; assert.ok((await slots(selection, "2030-01-01")).error);
});

test("UI reuses booking controls, invalidates review edits, refreshes conflicts and gates links on persistence", () => {
  const form = readFileSync(new URL('../components/appointments/AppointmentRequestForm.tsx', import.meta.url), "utf8");
  assert.match(form, /reviewed\?\.snapshot === snapshot/); assert.match(form, /!confirmed/); assert.match(form, /bookingReview/);
  assert.match(form, /refreshKey=\{state.status === "error" \? state.nonce/); assert.match(form, /state.status === "success"/);
  assert.match(form, /state.appointmentId/); assert.match(form, /bookingConfirmedTitle/); assert.match(form, /bookingRequestedTitle/); assert.match(form, /APPOINTMENT_TIME_ZONE/);
});
