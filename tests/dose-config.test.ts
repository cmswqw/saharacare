import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveDoseStatus,
  getLocalCalendarWindowStart,
  getTodayBounds,
} from "../lib/dose-config";

const scheduledAt = "2026-08-08T02:15:00.000Z"; // 08:00 Asia/Kathmandu

test("a future dose remains scheduled", () => {
  assert.equal(
    deriveDoseStatus("scheduled", scheduledAt, new Date("2026-08-08T02:14:59.000Z")),
    "scheduled",
  );
});

test("a dose remains scheduled until the late threshold", () => {
  assert.equal(
    deriveDoseStatus("scheduled", scheduledAt, new Date("2026-08-08T02:29:59.000Z")),
    "scheduled",
  );
});

test("a dose becomes late at 15 minutes", () => {
  assert.equal(
    deriveDoseStatus("scheduled", scheduledAt, new Date("2026-08-08T02:30:00.000Z")),
    "late",
  );
});

test("a dose remains late until the missed threshold", () => {
  assert.equal(
    deriveDoseStatus("scheduled", scheduledAt, new Date("2026-08-08T04:14:59.000Z")),
    "late",
  );
});

test("a dose becomes missed at 120 minutes", () => {
  assert.equal(
    deriveDoseStatus("scheduled", scheduledAt, new Date("2026-08-08T04:15:00.000Z")),
    "missed",
  );
});

test("taken state wins even after the missed threshold", () => {
  assert.equal(
    deriveDoseStatus("taken", scheduledAt, new Date("2026-08-09T00:00:00.000Z")),
    "taken",
  );
});

test("persisted late and missed states remain authoritative for demo events", () => {
  const beforeScheduledTime = new Date("2026-08-08T02:14:59.000Z");

  assert.equal(deriveDoseStatus("late", scheduledAt, beforeScheduledTime), "late");
  assert.equal(deriveDoseStatus("missed", scheduledAt, beforeScheduledTime), "missed");
});

test("today bounds use the Kathmandu calendar day rather than UTC", () => {
  assert.deepEqual(getTodayBounds(new Date("2026-08-08T12:00:00.000Z")), {
    start: "2026-08-07T18:15:00.000Z",
    end: "2026-08-08T18:15:00.000Z",
  });
});

test("weekly calendar window starts at Kathmandu midnight six days earlier", () => {
  assert.equal(
    getLocalCalendarWindowStart(7, new Date("2026-08-08T12:00:00.000Z")),
    "2026-08-01T18:15:00.000Z",
  );
});
