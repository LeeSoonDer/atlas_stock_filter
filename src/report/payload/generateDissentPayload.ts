import { BUCKET_THESIS_TEMPLATES } from "./dissentTemplates.js";

/**
 * TASK_CARD_05 SCOPE 4's "隔离铁律" (isolation iron rule) is enforced at
 * the TYPE level, not just by care in this function's body: this input
 * shape structurally cannot carry IndicatorFlags, fundamentals, sector
 * data, or any other evidence field - only what's needed to name the
 * bucket. A future edit that tried to pass more data would need to
 * change this type first, making an accidental leak harder to
 * introduce silently.
 */
export interface DissentInputCandidate {
  symbol: string;
  primaryBucket: string;
}

/**
 * Generates the ATLAS DISSENT PAYLOAD: per candidate, only the bucket
 * name + one fixed templated thesis sentence + an empty summary-card
 * skeleton for the Red Team to fill in as it works. Zero flag details,
 * zero reasoning text - satisfies SCOPE 4's "严禁携带旗标细节与任何推理
 * 性文字" by construction (there's nothing else in scope to leak).
 */
export function generateDissentPayload(candidates: DissentInputCandidate[], runTimestamp: string): string {
  const lines: string[] = [];
  lines.push("ATLAS DISSENT PAYLOAD");
  lines.push(`Run: ${runTimestamp}`);
  lines.push("");
  lines.push("本文件仅供红队(Red Team)上下文使用。不含任何旗标数值、证据细节或正方推理过程。");
  lines.push("");

  for (const c of candidates) {
    const thesis = BUCKET_THESIS_TEMPLATES[c.primaryBucket] ?? "该标的存在潜在重定价条件。";
    lines.push("* * *");
    lines.push(`标的: ${c.symbol}`);
    lines.push(`机会桶: ${c.primaryBucket}`);
    lines.push(`设想陈述: ${thesis}`);
    lines.push("摘要卡骨架:");
    lines.push("  评级: [待填]");
    lines.push("  概率评分: [待填]");
    lines.push("  确信度评分: [待填]");
    lines.push("  无效化条件: [待填]");
    lines.push("");
  }

  return lines.join("\n");
}
