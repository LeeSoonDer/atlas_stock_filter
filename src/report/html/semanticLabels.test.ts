import { test } from "node:test";
import assert from "node:assert/strict";
import { bbPercentileLabel, institutionalTrendLabel, rsiLabel, smaAlignmentLabel, volumeRatioLabel, week52PositionLabel } from "./semanticLabels.js";

test("rsiLabel: oversold, overbought, neutral, and null", () => {
  assert.equal(rsiLabel(27), "超卖");
  assert.equal(rsiLabel(75), "超买");
  assert.equal(rsiLabel(50), "中性");
  assert.equal(rsiLabel(null), "");
});

test("week52PositionLabel: near-high, near-low, mid-range", () => {
  assert.equal(week52PositionLabel(0.05), "近52周低点");
  assert.equal(week52PositionLabel(0.95), "近52周高点");
  assert.equal(week52PositionLabel(0.5), "中位区间");
});

test("smaAlignmentLabel and institutionalTrendLabel map booleans/enums correctly", () => {
  assert.equal(smaAlignmentLabel(true), "多头排列");
  assert.equal(smaAlignmentLabel(false), "非多头排列");
  assert.equal(institutionalTrendLabel("up"), "持股上升");
  assert.equal(institutionalTrendLabel(null), "不可得");
});

test("bbPercentileLabel and volumeRatioLabel boundary behavior", () => {
  assert.equal(bbPercentileLabel(15), "极度收缩");
  assert.equal(bbPercentileLabel(50), "正常波动");
  assert.equal(volumeRatioLabel(2.5), "显著放量");
  assert.equal(volumeRatioLabel(0.5), "缩量");
});
