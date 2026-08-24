import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFinraCsv } from "./parseFinraCsv.js";

const HEADER =
  "accountingYearMonthNumber|symbolCode|issueName|issuerServicesGroupExchangeCode|marketClassCode|currentShortPositionQuantity|previousShortPositionQuantity|stockSplitFlag|averageDailyVolumeQuantity|daysToCoverQuantity|revisionFlag|changePercent|changePreviousNumber|settlementDate";

test("parseFinraCsv: parses real-shaped rows by header name", () => {
  const csv = [
    HEADER,
    "20260731|A|Agilent Technologies Inc.|A|NYSE|5749623|7538437||2301495|2.50||-23.73|-1788814|2026-07-31",
    "20260731|AA|Alcoa Corporation|A|NYSE|9334029|8981785||5721292|1.63||3.92|352244|2026-07-31",
  ].join("\n");

  const records = parseFinraCsv(csv);
  assert.equal(records.size, 2);
  const a = records.get("A")!;
  assert.equal(a.currentShortShares, 5749623);
  assert.equal(a.previousShortShares, 7538437);
  assert.equal(a.daysToCover, 2.5);
  assert.equal(a.changePercent, -23.73);
  assert.equal(a.settlementDate, "2026-07-31");
});

test("parseFinraCsv: skips rows with non-numeric short share counts rather than fabricating", () => {
  const csv = [HEADER, "20260731|BAD|Bad Row Inc.|A|NYSE|not_a_number|123||1000|1.0||0|0|2026-07-31"].join("\n");
  const records = parseFinraCsv(csv);
  assert.equal(records.has("BAD"), false);
});

test("parseFinraCsv: throws on a header missing required columns rather than silently misreading", () => {
  assert.throws(() => parseFinraCsv("wrongHeader|onlyTwoCols\nfoo|bar"));
});

test("parseFinraCsv: empty input returns an empty map", () => {
  assert.equal(parseFinraCsv("").size, 0);
});
