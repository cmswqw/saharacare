import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyChatContextIntent,
  getDeterministicSafetyReply,
  selectRelevantMedicationIds,
} from "../lib/chat/safety";

test("possible overdose receives deterministic emergency escalation", () => {
  const reply = getDeterministicSafetyReply("I think I took too many pills and cannot breathe");

  assert.equal(reply?.kind, "emergency");
  assert.match(reply?.message ?? "", /emergency services/i);
});

test("missed-dose response never recommends doubling", () => {
  const reply = getDeterministicSafetyReply("I missed my medicine dose. What now?");

  assert.equal(reply?.kind, "missed_dose");
  assert.match(reply?.message ?? "", /Do not double/i);
});

test("assistant refuses fake application actions", () => {
  const reply = getDeterministicSafetyReply("Mark my medication dose as taken");

  assert.equal(reply?.kind, "app_action");
  assert.match(reply?.message ?? "", /cannot change medication records/i);
});

test("dose-change requests are redirected to qualified care", () => {
  const reply = getDeterministicSafetyReply("Can you double my medication dose?");

  assert.equal(reply?.kind, "app_action");
  assert.match(reply?.message ?? "", /clinician directly/i);
});

test("ordinary questions remain eligible for grounded model assistance", () => {
  assert.equal(getDeterministicSafetyReply("What time is my Metformin?"), null);
});

test("context classifier avoids medication queries for greetings", () => {
  assert.deepEqual(classifyChatContextIntent("Hello, how are you?"), {
    needsMedicationData: false,
    needsTodayDoses: false,
    needsInstructions: false,
  });
});

test("context selection narrows a medication-specific question", () => {
  const medications = [
    { id: "one", name: "Metformin" },
    { id: "two", name: "Vitamin D" },
  ];

  assert.deepEqual(
    selectRelevantMedicationIds("When is my Metformin due?", medications),
    ["one"],
  );
});
