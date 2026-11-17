import assert from "node:assert/strict";
import test from "node:test";

import { getAppointmentFacilities, getPatientHomeSummary } from "../lib/patient-home";
import type { Appointment, TodayDose } from "../types";

const now = Date.parse("2026-11-14T06:00:00.000Z");

function dose(id: string, scheduledAt: string, status: TodayDose["status"] = "scheduled"): TodayDose {
  return {
    id, schedule_id: `schedule-${id}`, scheduled_at: scheduledAt,
    taken_at: status === "taken" ? scheduledAt : null, persisted_status: status, status,
    medication: { id: `medicine-${id}`, name: "Synthetic medicine", dosage: "1 tablet", instructions: null },
  };
}

function appointment(
  id: string,
  startsAt: string,
  endsAt: string,
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id, patient_id: "synthetic-patient", doctor_id: "synthetic-doctor", doctor_name: "Synthetic doctor",
    facility: "Synthetic clinic", purpose: "Test", note: null, starts_at: startsAt, ends_at: endsAt,
    status: "confirmed", created_by: "synthetic-patient", created_by_role: "patient",
    created_by_name: "Synthetic patient", updated_by: null, cancelled_by: null,
    cancelled_at: null, created_at: startsAt, ...overrides,
  };
}

test("patient home keeps oldest overdue medicine and ongoing appointment visible without mutation", () => {
  const doses = [
    dose("future", "2026-11-14T08:00:00.000Z"),
    dose("taken", "2026-11-14T01:00:00.000Z", "taken"),
    dose("overdue", "2026-11-14T02:00:00.000Z", "missed"),
    dose("late", "2026-11-14T05:00:00.000Z", "late"),
  ];
  const appointments = [
    appointment("future", "2026-11-14T08:00:00.000Z", "2026-11-14T08:30:00.000Z"),
    appointment("ongoing", "2026-11-14T05:45:00.000Z", "2026-11-14T06:15:00.000Z"),
  ];
  const before = structuredClone({ doses, appointments });
  const summary = getPatientHomeSummary(doses, appointments, now);
  assert.equal(summary.nextDose, doses[2]);
  assert.equal(summary.nextAppointment, appointments[1]);
  assert.deepEqual({ doses, appointments }, before);
});

test("patient home returns no next medicine when doses are all taken or invalid", () => {
  assert.equal(getPatientHomeSummary([
    dose("taken", "2026-11-14T01:00:00.000Z", "taken"),
    dose("invalid", "not-a-timestamp"),
  ], [], now).nextDose, null);
  assert.deepEqual(getPatientHomeSummary([], [], now), { nextDose: null, nextAppointment: null });
});

test("patient home excludes cancelled, completed, ended and invalid appointments", () => {
  const appointments = [
    appointment("cancelled", "2026-11-14T06:00:00.000Z", "2026-11-14T06:30:00.000Z", { status: "cancelled" }),
    appointment("completed", "2026-11-14T06:00:00.000Z", "2026-11-14T06:30:00.000Z", { status: "completed" }),
    appointment("ended", "2026-11-14T05:30:00.000Z", "2026-11-14T06:00:00.000Z"),
    appointment("invalid-start", "invalid", "2026-11-14T07:00:00.000Z"),
    appointment("invalid-end", "2026-11-14T06:30:00.000Z", "invalid"),
    appointment("reversed", "2026-11-14T07:30:00.000Z", "2026-11-14T07:00:00.000Z"),
    appointment("later", "2026-11-14T09:00:00.000Z", "2026-11-14T09:30:00.000Z"),
    appointment("next", "2026-11-14T07:00:00.000Z", "2026-11-14T07:30:00.000Z", { status: "requested" }),
  ];
  assert.equal(getPatientHomeSummary([], appointments, now).nextAppointment?.id, "next");
  assert.equal(getPatientHomeSummary([], appointments.slice(0, 6), now).nextAppointment, null);
});

test("patient facilities trim and deduplicate names, ignore cancellations and select the latest appointment", () => {
  const appointments = [
    appointment("clinic-old", "2026-10-01T06:00:00.000Z", "2026-10-01T06:30:00.000Z", { facility: "  Valley Clinic ", status: "completed" }),
    appointment("other", "2026-11-15T06:00:00.000Z", "2026-11-15T06:30:00.000Z", { facility: "Hill Hospital" }),
    appointment("cancelled", "2026-12-01T06:00:00.000Z", "2026-12-01T06:30:00.000Z", { facility: "VALLEY CLINIC", status: "cancelled" }),
    appointment("clinic-new", "2026-11-14T06:00:00.000Z", "2026-11-14T06:30:00.000Z", { facility: "valley clinic" }),
    appointment("empty", "2026-11-14T06:00:00.000Z", "2026-11-14T06:30:00.000Z", { facility: "   " }),
  ];
  const before = structuredClone(appointments);
  assert.deepEqual(getAppointmentFacilities(appointments), [
    { name: "valley clinic", appointmentId: "clinic-new", visitCount: 2 },
    { name: "Hill Hospital", appointmentId: "other", visitCount: 1 },
  ]);
  assert.deepEqual(appointments, before);
});

test("patient facilities use alphabetical tie ordering and cap the display at four", () => {
  const appointments = ["Zeta", "Delta", "Beta", "Alpha", "Gamma"].map((facility) => (
    appointment(facility, "2026-11-14T06:00:00.000Z", "2026-11-14T06:30:00.000Z", { facility })
  ));
  assert.deepEqual(getAppointmentFacilities(appointments).map((facility) => facility.name), ["Alpha", "Beta", "Delta", "Gamma"]);
  assert.deepEqual(getAppointmentFacilities([]), []);
});
