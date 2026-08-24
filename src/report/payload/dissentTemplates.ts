/**
 * TASK_CARD_05 SCOPE 4: "一句设想陈述(由桶类型模板化生成...)". Fixed,
 * hardcoded templates keyed by bucket TYPE only - never generated,
 * never customized per symbol beyond substitution, satisfying "模板化
 *生成" literally. volatility_compression_setup's text is the exact
 * sentence given verbatim in the card's own SCOPE text.
 */
export const BUCKET_THESIS_TEMPLATES: Record<string, string> = {
  momentum_breakout: "该标的处于放量突破的动能延续阶段,存在趋势延续型重定价条件。",
  volatility_compression_setup: "该标的处于波动挤压后的蓄势末段,存在向上重定价条件。",
  oversold_reversal: "该标的处于极端超卖区域的反转初期,存在错杀修复型重定价条件。",
  institutional_accumulation_proxy: "该标的处于机构与内部人协同蓄势阶段,存在潜在资本重定价条件。",
};
