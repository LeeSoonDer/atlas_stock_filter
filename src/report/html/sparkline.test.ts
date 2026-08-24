import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSparklineSvg } from "./sparkline.js";

test("produces a valid SVG polyline with the correct number of points", () => {
  const svg = renderSparklineSvg([10, 20, 15, 25, 30]);
  assert.match(svg, /^<svg[^>]*>.*<\/svg>$/);
  const pointsMatch = svg.match(/points="([^"]+)"/);
  assert.ok(pointsMatch);
  const points = pointsMatch![1].split(" ");
  assert.equal(points.length, 5);
});

test("uses the up color when the series ends higher than it started", () => {
  const svg = renderSparklineSvg([10, 15, 20]);
  assert.ok(svg.includes("var(--up)"));
});

test("uses the down color when the series ends lower than it started", () => {
  const svg = renderSparklineSvg([20, 15, 10]);
  assert.ok(svg.includes("var(--down)"));
});

test("insufficient data (fewer than 2 points) returns an empty but valid svg, not a crash", () => {
  const svg = renderSparklineSvg([10]);
  assert.match(svg, /^<svg[^>]*><\/svg>$/);
});

test("flat series (constant price) does not divide by zero", () => {
  const svg = renderSparklineSvg([10, 10, 10, 10]);
  assert.doesNotThrow(() => svg);
  assert.ok(!svg.includes("NaN"));
});
