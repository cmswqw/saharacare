import assert from "node:assert/strict";
import test from "node:test";
import { directoryNepalDateTime, type DirectoryAdminActionState } from "../lib/directory/admin-contracts";
import { loadServerModule } from "./server-module";

const id = "11111111-1111-4111-8111-111111111111";
test("directory admin dates use Nepal time and reject rollover/invalid input", () => {
  assert.equal(directoryNepalDateTime("2026-11-15T09:00"), "2026-11-15T03:15:00.000Z");
  for (const value of ["", "2026-02-30T09:00", "2026-11-15T24:00", "2026-11-15T09:00Z", "2026-13-15T09:00"]) assert.equal(directoryNepalDateTime(value), null);
});

test("directory admin server helper checks verified user and active stored admin role", async () => {
  let user: { id: string } | null = { id };
  let role = "patient"; let status = "active"; let queriedId = "";
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: (_: string, value: string) => { queriedId = value; return { maybeSingle: async () => ({ data: { id, role, account_status: status }, error: null }) }; } }) }),
  };
  const module = loadServerModule("lib/data/directory-admin.ts", { "@/lib/supabase/server": { createClient: async () => client } });
  const read = module.getActiveDirectoryAdminClient as () => Promise<unknown>;
  assert.equal(await read(), null); assert.equal(queriedId, id);
  for (role of ["doctor", "caregiver"]) assert.equal(await read(), null);
  role = "admin"; status = "inactive"; assert.equal(await read(), null);
  status = "active"; assert.equal(await read(), client);
  user = null; assert.equal(await read(), null);
});

test("admin action rejects unauthorized callers, ignores client actor/status injection and hides DB errors", async () => {
  let allowed = false; let fail = false; const calls: { name: string; args: Record<string, unknown> }[] = []; const revalidated: string[] = [];
  const module = loadServerModule("app/actions/directory-admin.ts", {
    "@/lib/data/directory-admin": { getActiveDirectoryAdminClient: async () => allowed ? { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return fail ? { data: null, error: { message: "PRIVATE PAYMENT DETAILS" } } : { data: id, error: null }; } } : null },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
  });
  const action = module.manageDirectoryAction as (state: DirectoryAdminActionState, form: FormData) => Promise<DirectoryAdminActionState>;
  const form = new FormData();
  for (const [key, value] of Object.entries({ operation: "record_payment", id, reason: "External receipt checked", plan: "listing", payment_reference: "receipt-1", starts_at: "2026-11-15T09:00", ends_at: "2026-12-15T09:00", created_by: "attacker", role: "admin", is_demo: "false", payment_status: "paid" })) form.set(key, value);
  assert.equal((await action({ status: "idle" }, form)).status, "error"); assert.equal(calls.length, 0);
  allowed = true;
  assert.equal((await action({ status: "idle" }, form)).status, "success");
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ name: "manage_directory_listing", args: { requested_operation: "record_payment", payload: { id, reason: "External receipt checked", plan: "listing", payment_reference: "receipt-1", starts_at: "2026-11-15T03:15:00.000Z", ends_at: "2026-12-15T03:15:00.000Z" } } }));
  assert.deepEqual(revalidated, ["/admin"]);
  fail = true; assert.equal(JSON.stringify(await action({ status: "idle" }, form)), '{"status":"error"}');
  const before = calls.length;
  form.set("ends_at", "2026-10-15T09:00"); await action({ status: "idle" }, form);
  form.set("operation", "grant_admin"); await action({ status: "idle" }, form);
  form.set("reason", ""); await action({ status: "idle" }, form);
  assert.equal(calls.length, before);
});
