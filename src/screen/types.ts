export type ProfileName = "STANDARD" | "SMALL_SPEC";
export type ProfileArg = "standard" | "small_spec" | "both";

export interface ProfileGateConfig {
  minMarketCap: number;
  maxMarketCap: number | null;
  minAvgDollarVolume: number;
  /** TASK_CARD_08 Part A / Amendment No.5 修正案十七: hard admission gate, not a flag. */
  minPrice: number;
  speculative: boolean;
}

export type ProfilesConfig = Record<ProfileName, ProfileGateConfig>;
