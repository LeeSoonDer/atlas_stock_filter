import type { OHLCVBar } from "../../data/types.js";
import type { DetectorsConfig, IndicatorFlags } from "./types.js";
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

/**
 * Computes every single-symbol indicator (everything in IndicatorFlags
 * except rs3MonthPercentile/rs6MonthPercentile, which need cross-symbol
 * context and are filled in by the pipeline after this runs for every
 * symbol in the current screen run).
 */
export function computeIndicators(bars: OHLCVBar[], config: DetectorsConfig): IndicatorFlags {
  const clean = cleanBars(bars);
  const closes = clean.map((b) => b.close);
  const ic = config.indicators;

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
  };
}
