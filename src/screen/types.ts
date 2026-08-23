export type ProfileName = "STANDARD" | "SMALL_SPEC";
export type ProfileArg = "standard" | "small_spec" | "both";

export interface ProfileGateConfig {
  minMarketCap: number;
  maxMarketCap: number | null;
  minAvgDollarVolume: number;
  speculative: boolean;
}

export type ProfilesConfig = Record<ProfileName, ProfileGateConfig>;
