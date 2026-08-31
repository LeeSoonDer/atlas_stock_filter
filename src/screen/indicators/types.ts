export interface IndicatorFlags {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  smaAlignedBullish: boolean | null; // sma20 > sma50 > sma200 and close > sma20
  rsi14: number | null;
  atr14: number | null;
  atrPct: number | null;
  week52High: number | null;
  week52Low: number | null;
  week52PositionPct: number | null; // 0..1, (close - low) / (high - low)
  pctOf52WeekHigh: number | null; // 0..1+, close / week52High
  volumeAvg20: number | null;
  volumeAvg50: number | null;
  volumeRatioLatest: number | null; // latest volume / volumeAvg50
  maxVolumeRatioLast5Days: number | null;
  maxVolumeRatioLast10Days: number | null;
  obvLatest: number | null;
  obvSlope20: number | null;
  bbWidthLatest: number | null;
  bbWidthPercentile120: number | null; // 0..100
  sidewaysBaseDays: number | null;
  threeMonthReturn: number | null;
  sixMonthReturn: number | null;
  /** Filled in by the pipeline after cross-symbol ranking; null until then. */
  rs3MonthPercentile: number | null;
  rs6MonthPercentile: number | null;
  tradingDaysAvailable: number;
  latestClose: number | null;

  /**
   * TASK_CARD_04 SCOPE 6: "机构证据全部带滞后天数标注,并入flags" -
   * institutional evidence, always merged into flags. Populated by the
   * pipeline (not computeIndicators, which stays a pure OHLCV-only
   * function) after the insider/institutional-trend/short-interest
   * phases run. null/不可得 when genuinely unavailable - never fabricated.
   */
  insiderCluster: boolean | null;
  insiderClusterDistinctBuyers: number | null;
  insiderClusterLagDays: number | null;
  institutionalTrend: "up" | "down" | "flat" | null;
  institutionalTrendAvailability: "可得" | "不可得";
  shortInterestChangePercent: number | null;
  shortInterestDaysToCover: number | null;
  shortInterestPercentOfFloat: number | null;
  shortInterestLagDays: number | null;
  shortInterestAvailability: "可得" | "不可得";

  /**
   * TASK_CARD_09 Part A / 修正案十五: 隐性吸筹复合信号, all strength-add
   * flags only - never a bucket admission condition (see each detector's
   * own comment for where/how the bonus is applied). rsLineNewHigh needs
   * SPY bars, which computeIndicators (a pure OHLCV-only function) never
   * fetches - it is null there and filled in by the pipeline in the same
   * per-symbol loop once SPY bars are fetched once, up front.
   */
  rsLineNewHigh: boolean | null;
  volumeDryup: boolean | null;
  /** Daily-bar APPROXIMATION of VWAP (typical price, volume-weighted rolling window) - never real intraday VWAP. See aboveVwapStreak.ts. */
  aboveVwapStreak: boolean | null;
  /** TASK_CARD_09 Part A: upgraded from headcount to weighted score - see src/data/insiders/insiderWeighting.ts. Same availability semantics as insiderCluster (null/不可得 = no qualifying filing this run, not "zero score"). */
  insiderClusterWeightedScore: number | null;
}

export interface DetectorsConfig {
  indicators: {
    smaWindows: number[];
    rsiPeriod: number;
    atrPeriod: number;
    week52TradingDays: number;
    volumeAvgWindowShort: number;
    volumeAvgWindowLong: number;
    obvSlopeWindow: number;
    bollinger: { period: number; stdDev: number; widthPercentileWindow: number };
    relativeStrength: { threeMonthTradingDays: number; sixMonthTradingDays: number };
    sidewaysBase: { bandPct: number };
  };
  detectorA_momentumBreakout: {
    pctOf52WeekHigh: number;
    volumeRatioThreshold: number;
    volumeRatioLookbackDays: number;
    rs6MonthPercentileThreshold: number;
  };
  detectorB_volatilityCompression: {
    bbWidthPercentileThreshold: number;
    proximityTo52WeekHighPct: number;
    sidewaysBaseMinDays: number;
    volumeContractionRatioThreshold: number;
  };
  detectorC_oversoldReversal: {
    rsiThresholdStandard: number;
    rsiThresholdSmallSpec: number;
    week52PositionThreshold: number;
    stopLossVolumeRatioThreshold: number;
    stopLossLookbackDays: number;
  };
  /** Reshaped from config/card04.json at wire-up time (single source of truth stays card04.json) - see pipeline.ts. */
  detectorD_institutionalAccumulation: {
    minConditionsRequired: number;
    shortInterestSignificantDeclinePercent: number;
    squeezeMinFloatPercent: number;
  };
  /** TASK_CARD_09 Part A: merged in at wire-up time from config/card09.json, same pattern as detectorD_institutionalAccumulation above - see pipeline.ts's combinedDetectorsConfig. */
  latentAccumulation: {
    strengthBonusPerFlag: number;
  };
}

/** TASK_CARD_09 Part A. Reshaped from config/card09.json at wire-up time - see pipeline.ts. */
export interface LatentAccumulationConfig {
  latentAccumulation: {
    rsLineTradingDays: number;
    volumeDryupLookbackDays: number;
    volumeDryupRatioThreshold: number;
    aboveVwapStreakDays: number;
    aboveVwapRollingWindow: number;
    strengthBonusPerFlag: number;
  };
}
