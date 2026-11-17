import assert from "node:assert/strict";
import test from "node:test";
import { parseDirectoryMatches, parseDirectorySpecialties } from "../lib/directory/contracts";
import { loadServerModule } from "./server-module";

const row = {
  provider_id: "11111111-1111-4111-8111-111111111111", provider_type: "hospital",
  doctor_profile_id: null, display_name: "Synthetic hospital", public_phone: null,
  public_email: null, public_address: "Public test address", specialty_id: "general",
  specialty_name_en: "General", specialty_name_ne: "सामान्य", affiliation_id: null,
  facility_id: null, facility_name: null, facility_phone: null, facility_address: null,
  fee_amount: null, currency: null, is_sponsored: false,
  sponsorship_label_en: null, sponsorship_label_ne: null,
};

test("specialty catalog projects labels only, rejects malformed/duplicate IDs and distinguishes errors from empty", async () => {
  const specialty = { id: "general-medicine", name_en: "General Medicine", name_ne: "सामान्य चिकित्सा" };
  assert.deepEqual(parseDirectorySpecialties([{ ...specialty, private_notes: "PRIVATE" }]), [specialty]);
  for (const invalid of [[specialty, specialty], [{ ...specialty, id: "bad id" }], [{ ...specialty, name_ne: "" }]]) assert.equal(parseDirectorySpecialties(invalid), null);
  let signedIn = true;
  let response: { data: unknown; error: unknown } = { data: [], error: null };
  let calls = 0;
  const module = loadServerModule("lib/data/directory.ts", {
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: signedIn ? { id: "test" } : null }, error: null }) },
      rpc: async (name: string) => { assert.equal(name, "get_directory_specialties"); calls++; return response; },
    }) },
  });
  const read = module.getDirectorySpecialties as () => Promise<{ data: unknown[]; error: string | null }>;
  assert.equal((await read()).error, null);
  response = { data: [], error: { message: "PRIVATE ERROR" } }; assert.ok((await read()).error);
  response = { data: [{ ...specialty, private_notes: "PRIVATE" }], error: null }; assert.equal(JSON.stringify((await read()).data), JSON.stringify([specialty]));
  signedIn = false; const before = calls; assert.ok((await read()).error); assert.equal(calls, before);
});

test("directory projection never returns private DB fields or converts unknown fee to zero", () => {
  const result = parseDirectoryMatches([{ ...row, review_notes: "PRIVATE", payment_reference: "PRIVATE", internal_notes: "PRIVATE" }]);
  assert.deepEqual(result, [row]);
  assert.equal(result![0].fee_amount, null);
  assert.equal(parseDirectoryMatches([{ ...row, fee_amount: 100 }]), null);
  assert.equal(parseDirectoryMatches([{ ...row, fee_amount: 0, currency: "NPR" }])![0].fee_amount, 0);
  assert.equal(parseDirectoryMatches([{ ...row, fee_amount: NaN, currency: "NPR" }]), null);
  assert.equal(parseDirectoryMatches([{ ...row, is_sponsored: true }]), null);
  assert.equal(parseDirectoryMatches([{ ...row, provider_type: "doctor" }]), null);
});

test("directory server helper authenticates, preserves empty matching, and projects RPC output", async () => {
  const calls: unknown[] = [];
  let signedIn = true;
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "patient" } : null }, error: null }) },
    rpc: async (name: string, filters: unknown) => { calls.push({ name, filters }); return { data: [row], error: null }; },
  };
  const module = loadServerModule("lib/data/directory.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
  });
  const read = module.getDirectoryMatches as (filters?: unknown) => Promise<{ data: unknown[]; error: string | null }>;
  const result = await read({ specialtyIds: [] });
  assert.equal(result.error, null);
  assert.equal(result.data.length, 1);
  assert.equal(JSON.stringify(calls), JSON.stringify([{ name: "get_directory_matches", filters: {
    requested_specialty_ids: [], requested_provider_type: null, requested_provider_id: null,
  } }]));
  await read({ specialtyIds: ["bad id"] });
  assert.equal(calls.length, 1);
  signedIn = false;
  const denied = await read();
  assert.equal(denied.data.length, 0);
  assert.ok(denied.error);
  assert.equal(calls.length, 1);
});

test("directory errors are generic and failed/malformed RPCs return no results", async () => {
  let response: { data: unknown; error: unknown } = { data: [row], error: { message: "private payment metadata" } };
  const module = loadServerModule("lib/data/directory.ts", {
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "patient" } }, error: null }) },
      rpc: async () => response,
    }) },
  });
  const read = module.getDirectoryMatches as () => Promise<{ data: unknown[]; error: string | null }>;
  assert.equal(JSON.stringify(await read()), JSON.stringify({ data: [], error: "The directory is temporarily unavailable." }));
  response = { data: [{ ...row, currency: "invalid" }], error: null };
  assert.equal((await read()).data.length, 0);
});
