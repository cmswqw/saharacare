import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadServerModule } from "./server-module";

test("appointment read failures log safe schema diagnostics, never raw database data", async () => {
  const logs: unknown[] = [];
  const row = { id: "own", patient_id: "patient", doctor_id: "doctor", doctor: { full_name: "TEST Doctor" }, patient: null, creator: null };
  const config = { error: { code: "42703", message: "column appointments.directory_affiliation_id does not exist PRIVATE_MEDICAL_TEXT", details: "TOKEN", hint: "PATIENT_NAME" } as null | { code: string; message: string; details?: string; hint?: string }, status: 400 };
  const query = { select: () => query, eq: () => query, order: async () => ({ data: config.error ? null : [row], error: config.error, status: config.status }) };
  const service = loadServerModule("lib/data/appointments.ts", {
    "@/lib/supabase/server": { createClient: async () => ({ from: () => query }) },
    "@/lib/auth": { requireProfile: async () => ({ role: "patient", id: "patient" }) },
    "test:console": { error: (...args: unknown[]) => logs.push(args) },
  });
  const read = service.getAppointments as () => Promise<{ data: Array<{ id: string }>; error: string | null }>;
  assert.deepEqual(JSON.parse(JSON.stringify((await read()).data)), []);
  const log = JSON.stringify(logs);
  assert.match(log, /42703/); assert.match(log, /400/); assert.match(log, /missing_booking_snapshot_columns/);
  assert.match(log, /20261115061354_integrate_safe_directory_booking.sql/);
  assert.doesNotMatch(log, /PRIVATE_MEDICAL_TEXT|TOKEN|PATIENT_NAME/);
  assert.doesNotMatch((await read()).error ?? "", /column|migration|PRIVATE/);
  config.error = null; config.status = 200;
  const recovered = await read(); assert.equal(recovered.error, null); assert.equal(recovered.data[0].id, "own");
});

test("appointments failure has a localized recovery action, not an assumed migration diagnosis", () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source("app/patient/appointments/page.tsx"), /messageKey="appointmentsError" retry/);
  assert.match(source("components/ui/RetryDataButton.tsx"), /router.refresh\(\)/);
  assert.match(source("components/ui/RetryDataButton.tsx"), /disabled=\{pending\}/);
  for (const locale of ["en", "ne"]) {
    const message = source(`lib/i18n/${locale}.ts`).match(/appointmentsError: "([^"]+)"/)?.[1] ?? "";
    assert.ok(message); assert.doesNotMatch(message, /migration|SQL|Supabase/i);
  }
});
