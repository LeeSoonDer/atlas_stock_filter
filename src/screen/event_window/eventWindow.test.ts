import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEventWindow } from "./computeEventWindow.js";
import type { EventWindowConfig } from "./types.js";

const config: EventWindowConfig = { eventWindow: { windowDays: 180 } };
const NOW = new Date("2026-08-24T00:00:00Z");

test("earnings date within the window is registered with correct daysUntil", () => {
  const events = computeEventWindow("2026-10-29", NOW, config);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "earnings");
  assert.equal(events[0].date, "2026-10-29");
  assert.equal(events[0].daysUntil, 66); // Aug 24 -> Oct 29 = 66 days
});

test("earnings date beyond the window is not registered", () => {
  const events = computeEventWindow("2027-06-01", NOW, config); // > 180 days out
  assert.equal(events.length, 0);
});

test("a past earnings date is not registered (should already have been superseded upstream, but defensively excluded here too)", () => {
  const events = computeEventWindow("2026-01-01", NOW, config);
  assert.equal(events.length, 0);
});

test("no earnings date -> empty event list, not fabricated", () => {
  const events = computeEventWindow(undefined, NOW, config);
  assert.deepEqual(events, []);
});

test("earnings date exactly at the window boundary is included", () => {
  const events = computeEventWindow("2027-02-20", NOW, config); // exactly 180 days out
  assert.equal(events.length, 1);
  assert.equal(events[0].daysUntil, 180);
});
