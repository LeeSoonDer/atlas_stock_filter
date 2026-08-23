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
}
