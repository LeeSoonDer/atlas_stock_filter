import type { SectorRanking } from "../sector/types.js";

export type RegimeLabel = "顺风" | "中性" | "逆风";

export interface MarketRegimeSnapshot {
  asOf: string;
  spyLatestClose: number | null;
  spySma200: number | null;
  spyCloseVsSma200: "above" | "below" | null;
  spySma200Slope: number | null;
  vixCurrent: number | null;
  vixAvg20: number | null;
  leadingSectors: SectorRanking[];
  laggingSectors: SectorRanking[];
  label: RegimeLabel | null;
  /** Non-null only when `label` is null, explaining which input was unavailable. Descriptive only - never gates screening (SCOPE 3). */
  labelUnavailableReason: string | null;
}

export interface RegimeConfig {
  regime: {
    spySmaWindow: number;
    spySmaSlopeWindow: number;
    vixAvgWindow: number;
    vixElevatedThreshold: number;
  };
}
