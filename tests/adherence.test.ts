import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAdherence,
  wasDoseTakenLate,
  type AdherenceDoseInput,
} from "../lib/adherence";

const now = new Date("2026-08-08T06:00:00.000Z");

test("adherence excludes future scheduled doses", () => {
  const result = calculateAdherence([
    {
      scheduled_at: "2026-08-08T05:00:00.000Z",
      taken_at: "2026-08-08T05:04:00.000Z",
      status: "taken",
    },
    {
      scheduled_at: "2026-08-08T07:00:00.000Z",
      taken_at: null,
      status: "scheduled",
    },
  ], now);

  assert.equal(result.eligible, 1);
  assert.equal(result.taken, 1);
  assert.equal(result.percentage, 100);
});

test("adherence percentage and missed count use eligible doses", () => {
  const result = calculateAdherence([
    {
      scheduled_at: "2026-08-08T01:00:00.000Z",
      taken_at: "2026-08-08T01:05:00.000Z",
      status: "taken",
    },
    {
      scheduled_at: "2026-08-08T02:00:00.000Z",
      taken_at: null,
      status: "missed",
    },
    {
      scheduled_at: "2026-08-08T05:55:00.000Z",
      taken_at: null,
      status: "scheduled",
    },
  ], now);

  assert.deepEqual(result, {
    percentage: 33,
    taken: 1,
    eligible: 3,
    missed: 1,
    late: 0,
    pending: 1,
  });
});

test("a late-taken dose counts as taken and late", () => {
  const dose = {
    scheduled_at: "2026-08-08T03:00:00.000Z",
    taken_at: "2026-08-08T03:20:00.000Z",
    status: "taken" as const,
  };
  const result = calculateAdherence([dose], now);

  assert.equal(wasDoseTakenLate(dose), true);
  assert.equal(result.taken, 1);
  assert.equal(result.late, 1);
  assert.equal(result.percentage, 100);
});

test("no eligible doses returns an undefined percentage", () => {
  const result = calculateAdherence([], now);
  assert.equal(result.percentage, null);
  assert.equal(result.eligible, 0);
});

test("the Phase 8 demo sequence stays within the 85–95% presentation target", () => {
  const history: AdherenceDoseInput[] = Array.from({ length: 18 }, (_, index) => {
    const scheduled = new Date(now.getTime() - (index + 1) * 60 * 60 * 1000);
    const missed = index === 10;
    const lateTaken = index === 1 || index === 7 || index === 13;

    return {
      scheduled_at: scheduled.toISOString(),
      taken_at: missed
        ? null
        : new Date(scheduled.getTime() + (lateTaken ? 24 : 4) * 60 * 1000).toISOString(),
      status: missed ? "missed" : "taken",
    };
  });
  const dueNow: AdherenceDoseInput = {
    scheduled_at: new Date(now.getTime() - 1_000).toISOString(),
    taken_at: null,
    status: "scheduled",
  };

  assert.equal(calculateAdherence([...history, dueNow], now).percentage, 89);

  const takenNow: AdherenceDoseInput = {
    ...dueNow,
    taken_at: now.toISOString(),
    status: "taken",
  };
  assert.equal(calculateAdherence([...history, takenNow], now).percentage, 95);

  const lateDose: AdherenceDoseInput = {
    scheduled_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    taken_at: null,
    status: "late",
  };
  assert.equal(calculateAdherence([...history, takenNow, lateDose], now).percentage, 90);

  const missedDose: AdherenceDoseInput = {
    scheduled_at: new Date(now.getTime() - 130 * 60 * 1000).toISOString(),
    taken_at: null,
    status: "missed",
  };
  assert.equal(
    calculateAdherence([...history, takenNow, lateDose, missedDose], now).percentage,
    86,
  );
});
