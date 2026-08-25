import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRunFolder } from "./resolveRunFolder.js";

function freshBaseDir(): string {
  return mkdtempSync(join(tmpdir(), "atlas-runfolder-test-"));
}

test("first call for a given date returns the bare date folder", () => {
  const base = freshBaseDir();
  try {
    const folder = resolveRunFolder("2026-08-24T14:07:43.049Z", base);
    assert.equal(folder, `${base}/2026-08-24`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a second run the same day (bare folder already exists) gets an _HHMM suffix", () => {
  const base = freshBaseDir();
  try {
    mkdirSync(`${base}/2026-08-24`);
    const folder = resolveRunFolder("2026-08-24T14:09:19.214Z", base);
    assert.equal(folder, `${base}/2026-08-24_1409`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a third run the same day also gets its own distinct _HHMM suffix (no collision with the second)", () => {
  const base = freshBaseDir();
  try {
    mkdirSync(`${base}/2026-08-24`);
    mkdirSync(`${base}/2026-08-24_1409`);
    const folder = resolveRunFolder("2026-08-24T14:18:34.555Z", base);
    assert.equal(folder, `${base}/2026-08-24_1418`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a run on a new calendar day gets the bare folder again, even if prior dates have suffixed folders", () => {
  const base = freshBaseDir();
  try {
    mkdirSync(`${base}/2026-08-24`);
    mkdirSync(`${base}/2026-08-24_1409`);
    const folder = resolveRunFolder("2026-08-25T09:00:00.000Z", base);
    assert.equal(folder, `${base}/2026-08-25`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
