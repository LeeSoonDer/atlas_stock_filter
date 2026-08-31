import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFredObservations } from "./fredClient.js";

test("parseFredObservations: real FRED shape, numeric strings parsed to numbers", () => {
  const raw = {
    observations: [
      { realtime_start: "2020-01-01", realtime_end: "2020-01-01", date: "2020-02-19", value: "3.60" },
      { realtime_start: "2020-01-01", realtime_end: "2020-01-01", date: "2020-02-20", value: "3.65" },
    ],
  };
  const result = parseFredObservations(raw);
  assert.deepEqual(result, [
    { date: "2020-02-19", value: 3.6 },
    { date: "2020-02-20", value: 3.65 },
  ]);
});

test("parseFredObservations: \".\" missing-value marker becomes null, not 0 or NaN", () => {
  const raw = { observations: [{ date: "2020-12-25", value: "." }] };
  const result = parseFredObservations(raw);
  assert.deepEqual(result, [{ date: "2020-12-25", value: null }]);
});

test("parseFredObservations: malformed/missing observations array -> null", () => {
  assert.equal(parseFredObservations({ error_message: "Bad Request" }), null);
  assert.equal(parseFredObservations(null), null);
  assert.equal(parseFredObservations({ observations: "not an array" }), null);
});
