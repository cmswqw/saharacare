import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMedicalKyc } from "@/lib/medical-kyc/defaults";
import { buildMedicalSummarySections } from "@/lib/medical-kyc/summary";
import { medicalSummaryFilename } from "@/lib/medical-kyc/pdf";

test("medical summary keeps No, Unknown, Not provided, and Prefer not to answer distinct", () => {
  const kyc = createEmptyMedicalKyc("माया Sharma");
  kyc.allergies.answer = "no";
  kyc.currentConditions.answer = "not_sure";
  kyc.familyHistory.answer = "prefer_not_to_answer";
  const sections = buildMedicalSummarySections(kyc);
  assert.deepEqual(sections.find((section) => section.title.includes("Allergies"))?.lines, ["No"]);
  assert.deepEqual(sections.find((section) => section.title.includes("Current conditions"))?.lines, ["Unknown / not sure"]);
  assert.deepEqual(sections.find((section) => section.title.includes("Family history"))?.lines, ["Prefer not to answer"]);
  assert.deepEqual(sections.find((section) => section.title.includes("Other information"))?.lines, ["Not provided"]);
  assert.match(sections[0].lines[0], /माया Sharma/u);
});

test("medical summary filename uses the Asia/Kathmandu calendar date", () => {
  const instant = new Date("2026-08-16T19:00:00.000Z");
  assert.equal(medicalSummaryFilename(instant), "SaharaCare_Medical_Summary_2026-08-17.pdf");
});
