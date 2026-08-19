import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { dashboardPath } from "@/lib/auth-utils";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

const migrationPath = "supabase/migrations/20260819085246_implement_secure_admin_directory.sql";
const boundaryMigrationPath = "supabase/migrations/20260819085822_enforce_admin_medical_data_boundary.sql";
const minimizedMigrationPath = "supabase/migrations/20260819090500_minimize_admin_directory_payload.sql";

test("admin uses the existing dashboard role routing", () => {
  assert.equal(dashboardPath("admin"), "/admin");
  assert.equal(dashboardPath("patient"), "/patient");
  assert.equal(dashboardPath("caregiver"), "/caregiver");
  assert.equal(dashboardPath("doctor"), "/doctor");
});

test("admin routes require the server-verified admin role", () => {
  assert.match(source("app/admin/layout.tsx"), /requireRole\("admin"\)/);
  assert.match(source("lib/data/admin.ts"), /requireRole\("admin"\)/);
  assert.match(source("lib/supabase/middleware.ts"), /startsWith\("\/admin"\)/);
});

test("public signup cannot self-select or submit the admin role", () => {
  const authForm = source("components/auth/AuthForm.tsx");
  const migration = source(migrationPath);

  assert.doesNotMatch(authForm, /\{ value: "admin"/);
  assert.match(migration, /raw_user_meta_data ->> 'role' in \('patient', 'caregiver', 'doctor'\)/);
  assert.doesNotMatch(migration, /raw_user_meta_data ->> 'role' in \([^)]*'admin'/);
});

test("admin RPC is narrow, internally authorized, and unavailable to anon", () => {
  const migration = source(migrationPath);
  const rpcStart = migration.indexOf("create or replace function public.get_admin_directory()");
  const rpcEnd = migration.indexOf("revoke all on function public.get_admin_directory()", rpcStart);
  const rpc = migration.slice(rpcStart, rpcEnd);

  assert.ok(rpcStart >= 0 && rpcEnd > rpcStart);
  assert.match(rpc, /role = 'admin'/);
  assert.match(rpc, /errcode = '42501'/);
  assert.match(rpc, /security definer/);
  assert.match(rpc, /set search_path = ''/);
  assert.match(migration, /revoke all on function public\.get_admin_directory\(\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_directory\(\)[\s\S]*to authenticated/);
  assert.doesNotMatch(rpc, /medications|medication_schedules|dose_records|notifications|appointments|appointment_medical|storage\.|medical_share_config|auth\.users/i);
});

test("admin directory payload selects only minimal account and relationship fields", () => {
  const migration = source(minimizedMigrationPath);
  const rpcStart = migration.indexOf("create or replace function public.get_admin_directory()");
  const rpcEnd = migration.indexOf("revoke all on function public.get_admin_directory()", rpcStart);
  const rpc = migration.slice(rpcStart, rpcEnd);

  for (const allowedKey of ["displayName", "accountStatus", "createdAt", "caregivers", "patients", "role"]) {
    assert.match(rpc, new RegExp(`'${allowedKey}'`));
  }

  assert.doesNotMatch(rpc, /email|phone|address|date_of_birth|avatar_url|linking_code|demo_mode_enabled|allerg|diagnos|history|dosage|instructions/i);
  assert.doesNotMatch(rpc.slice(rpc.indexOf("'patients'"), rpc.indexOf("'doctors'")), /'createdAt'/);
});

test("restrictive RLS denies admin access to every persisted medical surface", () => {
  const migration = source(boundaryMigrationPath);
  const sensitiveTables = [
    "medications",
    "medication_schedules",
    "dose_records",
    "notifications",
    "appointments",
    "appointment_medical_shares",
    "appointment_medical_files",
  ];

  for (const table of sensitiveTables) {
    assert.match(migration, new RegExp(`on public\\.${table}\\s+[\\s\\S]*?as restrictive[\\s\\S]*?current_user_has_role\\('admin'\\)`, "i"));
  }

  assert.doesNotMatch(migration, /alter table .* disable row level security|grant all|service_role/i);
});
