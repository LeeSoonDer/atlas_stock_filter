/**
 * TASK_CARD_05 SCOPE 5: "核心旗标语义化呈现(数字旁配语义词:RSI 27 超卖)".
 * The card gives one example (RSI); this extends the same treatment to
 * a small, deliberately bounded set of the most reviewer-relevant
 * metrics rather than semantically labeling all ~30 IndicatorFlags
 * fields (which would be excessive) - a documented scope choice.
 */
export function rsiLabel(rsi: number | null): string {
  if (rsi === null) return "";
  if (rsi <= 30) return "超卖";
  if (rsi >= 70) return "超买";
  return "中性";
}

export function week52PositionLabel(pct: number | null): string {
  if (pct === null) return "";
  if (pct <= 0.2) return "近52周低点";
  if (pct >= 0.8) return "近52周高点";
  return "中位区间";
}

export function smaAlignmentLabel(aligned: boolean | null): string {
  if (aligned === null) return "";
  return aligned ? "多头排列" : "非多头排列";
}

export function bbPercentileLabel(pct: number | null): string {
  if (pct === null) return "";
  if (pct <= 20) return "极度收缩";
  if (pct >= 80) return "极度扩张";
  return "正常波动";
}

export function volumeRatioLabel(ratio: number | null): string {
  if (ratio === null) return "";
  if (ratio >= 1.8) return "显著放量";
  if (ratio <= 0.7) return "缩量";
  return "正常量能";
}

export function institutionalTrendLabel(trend: "up" | "down" | "flat" | null): string {
  if (trend === null) return "不可得";
  return { up: "持股上升", down: "持股下降", flat: "持股持平" }[trend];
}
