import type { OHLCVBar } from "../../data/types.js";
import type { DetectorsConfig, IndicatorFlags, LatentAccumulationConfig } from "./types.js";
import { cleanBars } from "./series.js";
import { sma } from "./sma.js";
import { rsi } from "./rsi.js";
import { atr, atrPct } from "./atr.js";
import { week52 } from "./week52.js";
import { volumeAvg, volumeRatioLatest, maxVolumeRatioLastNDays } from "./volume.js";
import { obvSeries, obvSlope } from "./obv.js";
import { bollingerWidthWithPercentile } from "./bollinger.js";
import { sidewaysBaseDays } from "./sidewaysBase.js";
import { trailingReturn } from "./relativeStrength.js";
import { volumeDryup } from "./volumeDryup.js";
import { aboveVwapStreak } from "./aboveVwapStreak.js";

/**
 * Computes every single-symbol indicator except rs3MonthPercentile/
 * rs6MonthPercentile (need a cross-symbol percentile pass after every
 * symbol's own indicators are computed), rsLineNewHigh (needs SPY bars,
 * filled in by the pipeline in the same per-symbol loop once SPY is
 * fetched - not itself cross-symbol, just needs one shared external
 * series fetched ahead of time), and insiderClusterWeightedScore
 * (TASK_CARD_04-era institutional/insider fields, unchanged pattern).
 */
export function computeIndicators(bars: OHLCVBar[], config: DetectorsConfig, latentConfig: LatentAccumulationConfig): IndicatorFlags {
  const clean = cleanBars(bars);
  const closes = clean.map((b) => b.close);
  const ic = config.indicators;
  const lc = latentConfig.latentAccumulation;

  const [sma20, sma50, sma200] = ic.smaWindows.map((w) => sma(closes, w));
  const latestClose = closes.length > 0 ? closes[closes.length - 1] : null;
  const smaAlignedBullish =
    sma20 !== null && sma50 !== null && sma200 !== null && latestClose !== null
      ? sma20 > sma50 && sma50 > sma200 && latestClose > sma20
      : null;

  const atr14 = atr(clean, ic.atrPeriod);
  const w52 = week52(clean, ic.week52TradingDays, latestClose);
  const obv = obvSeries(clean);
  const bb = bollingerWidthWithPercentile(closes, ic.bollinger.period, ic.bollinger.stdDev, ic.bollinger.widthPercentileWindow);

  return {
    sma20,
    sma50,
    sma200,
    smaAlignedBullish,
    rsi14: rsi(closes, ic.rsiPeriod),
    atr14,
    atrPct: atrPct(atr14, latestClose),
    week52High: w52.high,
    week52Low: w52.low,
    week52PositionPct: w52.positionPct,
    pctOf52WeekHigh: w52.pctOfHigh,
    volumeAvg20: volumeAvg(clean, ic.volumeAvgWindowShort),
    volumeAvg50: volumeAvg(clean, ic.volumeAvgWindowLong),
    volumeRatioLatest: volumeRatioLatest(clean, ic.volumeAvgWindowLong),
    maxVolumeRatioLast5Days: maxVolumeRatioLastNDays(clean, 5, ic.volumeAvgWindowLong),
    maxVolumeRatioLast10Days: maxVolumeRatioLastNDays(clean, 10, ic.volumeAvgWindowLong),
    obvLatest: obv.length > 0 ? obv[obv.length - 1] : null,
    obvSlope20: obvSlope(obv, ic.obvSlopeWindow),
    bbWidthLatest: bb.latest,
    bbWidthPercentile120: bb.percentile,
    sidewaysBaseDays: sidewaysBaseDays(closes, ic.sidewaysBase.bandPct),
    threeMonthReturn: trailingReturn(closes, ic.relativeStrength.threeMonthTradingDays),
    sixMonthReturn: trailingReturn(closes, ic.relativeStrength.sixMonthTradingDays),
    rs3MonthPercentile: null,
    rs6MonthPercentile: null,
    tradingDaysAvailable: clean.length,
    latestClose,
    // TASK_CARD_04 institutional fields: not this function's concern (it
    // stays a pure OHLCV-only computation) - the pipeline overwrites
    // these after the insider/institutional-trend/short-interest phases
    // run. Defaulting to "not available yet" rather than omitting them
    // keeps IndicatorFlags's type honest about what every field means.
    insiderCluster: null,
    insiderClusterDistinctBuyers: null,
    insiderClusterLagDays: null,
    institutionalTrend: null,
    institutionalTrendAvailability: "不可得",
    shortInterestChangePercent: null,
    shortInterestDaysToCover: null,
    shortInterestPercentOfFloat: null,
    shortInterestLagDays: null,
    shortInterestAvailability: "不可得",
    rsLineNewHigh: null,
    volumeDryup: volumeDryup(clean, lc.volumeDryupLookbackDays, ic.volumeAvgWindowLong, lc.volumeDryupRatioThreshold),
    aboveVwapStreak: aboveVwapStreak(clean, lc.aboveVwapStreakDays, lc.aboveVwapRollingWindow),
    insiderClusterWeightedScore: null,
  };
}
