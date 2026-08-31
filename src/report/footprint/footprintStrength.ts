import type { FootprintCondition } from "../../screen/detectors/IDetector.js";

export interface FootprintStrength {
  ratio: number | null;
  band: string;
  hitCount: number;
  availableCount: number;
  totalCount: number;
}

/**
 * claude_code_design_draft.md §1.2. `availableCount` excludes `unavailable`
 * conditions from the denominator entirely (they neither help nor hurt the
 * ratio) - `null` ratio ONLY happens when every single condition checked
 * is unavailable, which must render as "不可得" with no progress bar, not
 * a 0% one (§1.2's own explicit instruction).
 */
export function computeFootprintStrength(
  conditions: FootprintCondition[],
  bands: Array<{ minRatio: number; band: string }>,
): FootprintStrength {
  const availableCount = conditions.filter((c) => c.status !== "unavailable").length;
  const hitCount = conditions.filter((c) => c.status === "hit").length;
  const ratio = availableCount === 0 ? null : hitCount / availableCount;

  if (ratio === null) {
    return { ratio: null, band: "不可得", hitCount, availableCount, totalCount: conditions.length };
  }

  const sorted = [...bands].sort((a, b) => b.minRatio - a.minRatio);
  const band = sorted.find((b) => ratio >= b.minRatio)?.band ?? sorted[sorted.length - 1]?.band ?? "不可得";
  return { ratio, band, hitCount, availableCount, totalCount: conditions.length };
}

/**
 * Concatenates every triggered bucket's condition list for a symbol that
 * hit more than one detector (§1.1's "双桶命中的标的...合并两个桶的条件清单,
 * 保留 bucket 字段以便分组显示") - order follows `buckets` (which itself
 * follows BUCKET_ORDER, since pipeline.ts pushes into it in detector-array
 * order), so the merged list is always deterministic given the same hits.
 */
export function mergeFootprintDetail(
  buckets: string[],
  conditionsByBucket: Map<string, FootprintCondition[]>,
): FootprintCondition[] {
  return buckets.flatMap((b) => conditionsByBucket.get(b) ?? []);
}
