import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLatentAccumulationBonus } from "./latentAccumulationBonus.js";

test("applyLatentAccumulationBonus: each true flag adds bonusPerFlag points", () => {
  assert.equal(applyLatentAccumulationBonus(50, [true, true], 5), 60);
});

test("applyLatentAccumulationBonus: false and null flags contribute nothing", () => {
  assert.equal(applyLatentAccumulationBonus(50, [false, null], 5), 50);
});

test("applyLatentAccumulationBonus: total is capped at 100 even when bonuses would exceed it", () => {
  assert.equal(applyLatentAccumulationBonus(98, [true, true, true], 5), 100);
});

test("applyLatentAccumulationBonus: empty flag list is a no-op", () => {
  assert.equal(applyLatentAccumulationBonus(72, [], 5), 72);
});
