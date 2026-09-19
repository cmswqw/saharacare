import test from "node:test";
import assert from "node:assert/strict";
import { canManageAppointmentMedicalShare, canViewAppointmentMedicalFile } from "@/lib/medical-files/authorization";
import { detectMedicalFileType, sanitizeMedicalFilename } from "@/lib/medical-files/validation";
import { loadServerModule } from "./server-module";

test("medical upload validation recognizes only accepted magic bytes", () => {
  assert.equal(detectMedicalFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), "application/pdf");
  assert.equal(detectMedicalFileType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectMedicalFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectMedicalFileType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectMedicalFileType(new TextEncoder().encode("<script>not a medical file</script>")), null);
});

test("medical filenames cannot inject storage paths", () => {
  assert.equal(sanitizeMedicalFilename("../private\\record.pdf"), "private_record.pdf");
  assert.equal(sanitizeMedicalFilename("\u0000"), "medical-document");
});

test("only the patient can manage their own non-cancelled appointment share", () => {
  assert.equal(canManageAppointmentMedicalShare({ userId: "patient-a", role: "patient", patientId: "patient-a", appointmentStatus: "confirmed" }), true);
  assert.equal(canManageAppointmentMedicalShare({ userId: "patient-b", role: "patient", patientId: "patient-a", appointmentStatus: "confirmed" }), false);
  assert.equal(canManageAppointmentMedicalShare({ userId: "patient-a", role: "patient", patientId: "patient-a", appointmentStatus: "cancelled" }), false);
  assert.equal(canManageAppointmentMedicalShare({ userId: "doctor-a", role: "doctor", patientId: "patient-a", appointmentStatus: "confirmed" }), false);
});

test("file view is assigned-participant only and fails closed on expiry, revocation, or cancellation", () => {
  const base = {
    patientId: "patient-a",
    doctorId: "doctor-a",
    appointmentStatus: "confirmed" as const,
    expiresAt: "2026-08-17T12:00:00.000Z",
    revokedAt: null,
    now: new Date("2026-08-17T11:00:00.000Z"),
  };
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "patient-a", role: "patient" }), true);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor" }), true);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-b", role: "doctor" }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "caregiver-a", role: "caregiver" }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor", now: new Date("2026-08-17T12:00:00.000Z") }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor", revokedAt: "2026-08-17T11:30:00.000Z" }), false);
  assert.equal(canViewAppointmentMedicalFile({ ...base, userId: "doctor-a", role: "doctor", appointmentStatus: "cancelled" }), false);
});

type Query = { table: string; calls: Array<{ method: string; args: unknown[] }> };
type DatabaseResult = { data?: unknown; error?: unknown };

function fakeDatabase(respond: (query: Query) => DatabaseResult) {
  const queries: Query[] = [];
  return {
    queries,
    from(table: string) {
      const query: Query = { table, calls: [] };
      queries.push(query);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "insert", "update", "delete", "eq", "neq", "is", "in", "lte", "not", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          query.calls.push({ method, args });
          return builder;
        };
      }
      const result = () => Promise.resolve({ error: null, data: null, ...respond(query) });
      builder.single = result;
      builder.maybeSingle = result;
      builder.then = (fulfilled: (value: DatabaseResult) => unknown, rejected: (error: unknown) => unknown) => result().then(fulfilled, rejected);
      return builder;
    },
  };
}

function hasCall(query: Query, method: string) {
  return query.calls.some((call) => call.method === method);
}

const revokePath = "app/api/medical-shares/[shareId]/route.ts";
const uploadPath = "app/api/appointments/[appointmentId]/medical-share/route.ts";
const viewPath = "app/api/medical-shares/[shareId]/files/[fileId]/view/route.ts";
const baseUrl = "https://care.example";
const patientAppointment = { id: "appointment-a", patient_id: "patient-a", doctor_id: "doctor-a", status: "confirmed" };

function routeMocks(
  admin: unknown,
  user: { id: string; role: string } | null = { id: "patient-a", role: "patient" },
) {
  return {
    "next/server": { NextResponse: { json: Response.json.bind(Response) } },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: user ? { id: user.id } : null }, error: null }) },
      ...fakeDatabase(() => ({ data: user ? { role: user.role } : null })),
    }) },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
  };
}

test("medical share mutations reject cross-origin requests before accessing authentication or data", async () => {
  for (const [path, method] of [[revokePath, "DELETE"], [uploadPath, "POST"]]) {
    const module = loadServerModule(path, {
      "next/server": { NextResponse: { json: Response.json.bind(Response) } },
      "@/lib/supabase/server": { createClient() { throw new Error("Authentication should not run."); } },
      "@/lib/supabase/admin": { createAdminClient() { throw new Error("Admin client should not run."); } },
    });
    const handler = module[method] as (request: Request) => Promise<Response>;
    const response = await handler(new Request(`${baseUrl}/api/test`, {
      method, headers: { origin: "https://untrusted.care.example" },
    }));
    assert.equal(response.status, 403);
  }
});

test("medical revocation confirms persistence and never reports database failure as success", async () => {
  for (const outcome of ["saved", "database-error", "missing-row"]) {
    const admin = fakeDatabase((query) => {
      if (query.table === "appointments") return { data: patientAppointment };
      if (hasCall(query, "update")) {
        if (outcome === "database-error") return { error: { message: "synthetic private database details" } };
        if (outcome === "missing-row") return { data: null };
        return { data: { id: "share-a", revoked_at: new Date().toISOString() } };
      }
      return { data: { id: "share-a", appointment_id: "appointment-a", revoked_at: null } };
    });
    const handler = loadServerModule(revokePath, routeMocks(admin)).DELETE as (request: Request, context: unknown) => Promise<Response>;
    const response = await handler(new Request(`${baseUrl}/api/medical-shares/share-a`, {
      method: "DELETE", headers: { origin: baseUrl },
    }), { params: Promise.resolve({ shareId: "share-a" }) });
    assert.equal(response.status, outcome === "saved" ? 200 : 500);
    const body = await response.json();
    assert.equal(body.ok, outcome === "saved");
    assert.doesNotMatch(JSON.stringify(body), /synthetic private database details/);
  }
});

test("medical share routes deny unauthenticated and unrelated actors before mutation", async () => {
  for (const actor of [null, { id: "patient-b", role: "patient" }, { id: "doctor-a", role: "doctor" }, { id: "caregiver-a", role: "caregiver" }]) {
    for (const [path, method] of [[revokePath, "DELETE"], [uploadPath, "POST"]]) {
      const admin = fakeDatabase((query) => ({ data: query.table === "appointments"
        ? patientAppointment
        : { id: "share-a", appointment_id: "appointment-a", revoked_at: null } }));
      const handler = loadServerModule(path, routeMocks(admin, actor))[method] as (request: Request, context: unknown) => Promise<Response>;
      const response = await handler(new Request(`${baseUrl}/api/test`, {
        method, headers: { origin: baseUrl },
      }), { params: Promise.resolve({ shareId: "share-a", appointmentId: "appointment-a" }) });
      assert.equal(response.status, actor ? 403 : 401);
      assert.equal(admin.queries.some((query) => hasCall(query, "insert") || hasCall(query, "update")), false);
    }
  }
});

function medicalUploadRequest() {
  const form = new FormData();
  form.set("summary", new File(["%PDF-1.4\nsynthetic fixture"], "synthetic.pdf", { type: "application/pdf" }));
  return new Request(`${baseUrl}/api/appointments/appointment-a/medical-share`, {
    method: "POST", headers: { origin: baseUrl }, body: form,
  });
}

test("medical replacement cannot publish new files if revoking older access fails", async () => {
  for (const revokeFails of [false, true]) {
    const events: string[] = [];
    const database = fakeDatabase((query) => {
      if (query.table === "appointments") return { data: patientAppointment };
      if (query.table === "appointment_medical_shares" && hasCall(query, "insert")) {
        return { data: { id: "new-share", appointment_id: "appointment-a", expires_at: "2099-01-01T00:00:00Z" } };
      }
      if (query.table === "appointment_medical_shares" && hasCall(query, "update")) {
        events.push("revoke-old");
        return revokeFails ? { error: { message: "synthetic database failure" } } : {};
      }
      if (query.table === "appointment_medical_files" && hasCall(query, "update")) events.push("publish-ready");
      return {};
    });
    const admin = { ...database, storage: { from: () => ({
      upload: async () => ({ error: null }),
      remove: async () => ({ error: null }),
    }) } };
    const handler = loadServerModule(uploadPath, routeMocks(admin)).POST as (request: Request, context: unknown) => Promise<Response>;
    const response = await handler(medicalUploadRequest(), { params: Promise.resolve({ appointmentId: "appointment-a" }) });
    assert.equal(response.status, revokeFails ? 500 : 201);
    assert.deepEqual(events, revokeFails ? ["revoke-old"] : ["revoke-old", "publish-ready"]);
    assert.equal(database.queries.some((query) => query.table === "appointment_medical_shares" && hasCall(query, "delete")), revokeFails);
  }
});

test("medical upload does not expose internal database errors", async () => {
  const admin = fakeDatabase((query) => query.table === "appointments"
    ? { data: patientAppointment }
    : { error: { message: "synthetic private schema detail" } });
  const handler = loadServerModule(uploadPath, routeMocks(admin)).POST as (request: Request, context: unknown) => Promise<Response>;
  const response = await handler(medicalUploadRequest(), { params: Promise.resolve({ appointmentId: "appointment-a" }) });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /synthetic private schema detail/);
});

test("medical upload bounds the body before multipart parsing and rejects malformed input", async () => {
  for (const oversized of [false, true]) {
    const admin = fakeDatabase(() => ({ data: patientAppointment }));
    const handler = loadServerModule(uploadPath, routeMocks(admin), {
      MEDICAL_FILE_MAX_BYTES: "1024", MEDICAL_FILE_MAX_COUNT: "1",
    }).POST as (request: Request, context: unknown) => Promise<Response>;
    const response = await handler(new Request(`${baseUrl}/api/test`, {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "multipart/form-data; boundary=synthetic" },
      body: oversized ? "x".repeat(70_000) : "invalid multipart",
    }), { params: Promise.resolve({ appointmentId: "appointment-a" }) });
    assert.equal(response.status, oversized ? 413 : 400);
    assert.equal(admin.queries.some((query) => hasCall(query, "insert") || hasCall(query, "update")), false);
  }
});

test("medical file endpoint enforces assignment, expiry, revocation, cancellation, and readiness", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.4\nsynthetic fixture");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const cases = [
    { actor: { id: "patient-a", role: "patient" }, status: 200 },
    { actor: { id: "doctor-a", role: "doctor" }, status: 200 },
    { actor: { id: "doctor-b", role: "doctor" }, status: 403 },
    { actor: { id: "patient-b", role: "patient" }, status: 403 },
    { actor: { id: "caregiver-a", role: "caregiver" }, status: 403 },
    { actor: { id: "doctor-a", role: "doctor" }, expires_at: "2000-01-01T00:00:00Z", status: 403 },
    { actor: { id: "doctor-a", role: "doctor" }, revoked_at: "2026-01-01T00:00:00Z", status: 403 },
    { actor: { id: "doctor-a", role: "doctor" }, appointmentStatus: "cancelled", status: 403 },
    { actor: { id: "doctor-a", role: "doctor" }, upload_status: "pending", status: 404 },
  ];
  for (const fixture of cases) {
    let downloads = 0;
    const database = fakeDatabase((query) => {
      if (query.table === "appointments") return { data: { ...patientAppointment, status: fixture.appointmentStatus ?? "confirmed" } };
      if (query.table === "appointment_medical_shares") return { data: {
        appointment_id: "appointment-a", expires_at: fixture.expires_at ?? "2099-01-01T00:00:00Z", revoked_at: fixture.revoked_at ?? null,
      } };
      return { data: {
        id: "file-a", share_id: "share-a", storage_reference: "share/share-a/file-a", mime_type: "application/pdf", content_sha256: hash,
        upload_status: fixture.upload_status ?? "ready",
      } };
    });
    const admin = { ...database, storage: { from: () => ({ download: async () => {
      downloads += 1;
      return { data: new Blob([bytes]), error: null };
    } }) } };
    const handler = loadServerModule(viewPath, routeMocks(admin, fixture.actor)).GET as (request: Request, context: unknown) => Promise<Response>;
    const response = await handler(new Request(`${baseUrl}/api/test`), { params: Promise.resolve({ shareId: "share-a", fileId: "file-a" }) });
    assert.equal(response.status, fixture.status);
    assert.equal(downloads, fixture.status === 200 ? 1 : 0);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("medical cleanup skips completed audit rows so later expired files are not starved", async () => {
  const auditRows = Array.from({ length: 101 }, (_, index) => ({ id: `share-${index}`, revoked_at: null, hasFiles: index === 100 }));
  const removed: string[] = [];
  const database = fakeDatabase((query) => {
    if (hasCall(query, "update") || hasCall(query, "delete")) return {};
    if (query.table === "appointment_medical_files") return { data: [{ id: "file-a", storage_reference: "share/share-100/file-a" }] };
    if (hasCall(query, "not")) return { data: [] };
    const columns = query.calls.find((call) => call.method === "select")?.args[0] as string;
    return { data: auditRows.filter((row) => !columns.includes("!inner") || row.hasFiles).slice(0, 100) };
  });
  const admin = { ...database, storage: { from: () => ({ remove: async (paths: string[]) => {
    removed.push(...paths);
    return { error: null };
  } }) } };
  const module = loadServerModule("app/api/cron/medical-share-cleanup/route.ts", {
    ...routeMocks(admin),
    "@/lib/cron": { hasValidCronSecret: () => true },
  });
  const handler = module.GET as (request: Request) => Promise<Response>;
  const response = await handler(new Request(`${baseUrl}/api/cron/medical-share-cleanup`));
  assert.equal(response.status, 200);
  assert.deepEqual(removed, ["share/share-100/file-a"]);
  assert.deepEqual(await response.json(), { ok: true, processedShares: 1, cleanedFiles: 1 });
  assert.equal(database.queries.some((query) => query.table === "appointment_medical_shares" && hasCall(query, "delete")), false);
});
