import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { en } from "../lib/i18n/en";
import { ne } from "../lib/i18n/ne";
import { translate } from "../lib/i18n/index";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

test("English and Nepali dictionaries expose exactly the same keys", () => {
  assert.deepEqual(Object.keys(ne).sort(), Object.keys(en).sort());
});

test("localized text interpolates dynamic UI values", () => {
  assert.equal(
    translate("en", "copyright", { year: 2026 }),
    "© 2026 SaharaCare. All rights reserved.",
  );
  assert.equal(
    translate("ne", "greetingName", { name: "Maya" }),
    "नमस्ते, Maya",
  );
  assert.notEqual(translate("ne", "addMedication"), translate("en", "addMedication"));
  assert.notEqual(translate("ne", "kycTitle"), translate("en", "kycTitle"));
  assert.notEqual(translate("ne", "shareWithDoctor"), translate("en", "shareWithDoctor"));
  assert.notEqual(translate("ne", "newChat"), translate("en", "newChat"));
});

test("role choices use shared fixed dimensions and accessible focus styling", () => {
  const rolePage = source("app/role/page.tsx");
  const authForm = source("components/auth/AuthForm.tsx");

  assert.match(rolePage, /h-\[25rem\] min-h-\[25rem\] w-full/);
  assert.match(rolePage, /focus-visible:ring-4/);
  assert.match(authForm, /h-20 min-h-20 w-full/);
  assert.match(authForm, /focus-visible:ring-4/);
});

test("authentication footer uses the localized dynamic copyright year", () => {
  const authForm = source("components/auth/AuthForm.tsx");
  assert.match(authForm, /t\("copyright", \{ year: new Date\(\)\.getFullYear\(\) \}\)/);
});

test("medicine dialog is constrained to the dynamic viewport and scrolls internally", () => {
  const modal = source("components/ui/Modal.tsx");
  const medicationForm = source("components/medicine/MedicationForm.tsx");

  assert.match(modal, /h-dvh/);
  assert.match(modal, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(modal, /overflow-x-hidden overflow-y-auto/);
  assert.match(medicationForm, /sticky bottom-0/);
  assert.match(medicationForm, /min-h-14 min-w-0 flex-1/);
});

test("quick actions span the desktop dashboard grid and contain localized labels", () => {
  const sections = source("components/patient/PatientDashboardSections.tsx");

  assert.match(sections, /xl:col-span-2/);
  assert.match(sections, /grid-cols-1 gap-4 min-\[375px\]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5/);
  assert.match(sections, /min-h-32 min-w-0 w-full/);
  assert.match(sections, /leading-tight whitespace-normal break-words \[overflow-wrap:anywhere\]/);
  assert.match(sections, /focus-visible:ring-4/);
  for (const route of [
    "/patient/medicines",
    "/patient/appointments",
    "/patient/medical-information",
    "/patient/assistant",
    "/patient/profile",
  ]) {
    assert.match(sections, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("TSX does not contain unreviewed hard-coded English JSX labels", () => {
  const files: string[] = [];
  const allowed = new Set(["SaharaCare", "English", "Maya Sharma", "SC-XXXXXXXXXX"]);
  const relevantAttributes = new Set(["placeholder", "title", "aria-label", "alt", "description", "label"]);
  const unexpected: string[] = [];

  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith(".tsx")) files.push(fullPath);
    }
  }

  walk(resolve(projectRoot, "app"));
  walk(resolve(projectRoot, "components"));

  for (const file of files) {
    const contents = readFileSync(file, "utf8");
    const parsed = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function record(node: ts.Node, value: string) {
      const visible = value.replace(/\s+/g, " ").trim();
      if (!/[A-Za-z]{2}/.test(visible) || allowed.has(visible)) return;
      const location = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
      unexpected.push(`${file.slice(projectRoot.length + 1)}:${location.line + 1}: ${visible}`);
    }

    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) record(node, node.text);
      if (
        ts.isJsxAttribute(node)
        && relevantAttributes.has(node.name.getText(parsed))
        && node.initializer
        && ts.isStringLiteral(node.initializer)
      ) {
        record(node, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    }

    visit(parsed);
  }

  assert.deepEqual(unexpected, []);
});
