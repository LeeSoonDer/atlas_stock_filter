import type { Availability } from "../../data/types.js";
import type { InstitutionalSnapshot, InstitutionalTrend, InstitutionalTrendConfig } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InstitutionalTrendResult {
  trend: InstitutionalTrend | null;
  availability: Availability;
}

/**
 * TASK_CARD_04 SCOPE 2: "机构持股比例近两期方向(上升/下降/持平/不可得)".
 * Yahoo has no API giving a clean multi-period aggregate institutional-%
 * trend (verified live: majorHoldersBreakdown is a single snapshot;
 * institutionOwnership only gives each individual top-10 holder's own
 * pctChange, not an aggregate) - so this compares this run's snapshot
 * against a prior run's snapshot, both persisted in
 * checkpoint.institutionalHistory. Needs >= 2 snapshots genuinely
 * minDaysBetweenSnapshots apart (config-driven, default 60 - roughly a
 * quarter, since institutional holdings data itself only updates on
 * that cadence) to count as a real "period" comparison; on this card's
 * first-ever run, every symbol will correctly show 不可得 (no second
 * snapshot exists yet) - not a bug, disclosed in ai/decisions.md.
 */
export function computeInstitutionalTrend(
  history: InstitutionalSnapshot[],
  config: InstitutionalTrendConfig,
  now: Date = new Date(),
): InstitutionalTrendResult {
  if (history.length < 2) return { trend: null, availability: "不可得" };

  const sorted = [...history].sort((a, b) => a.asOf.localeCompare(b.asOf));
  const latest = sorted[sorted.length - 1];
  const prior = sorted[sorted.length - 2];

  const daysBetween = (new Date(latest.asOf).getTime() - new Date(prior.asOf).getTime()) / DAY_MS;
  if (daysBetween < config.institutionalTrend.minDaysBetweenSnapshots) {
    return { trend: null, availability: "不可得" };
  }

  const diffPercentagePoints = (latest.institutionsPercentHeld - prior.institutionsPercentHeld) * 100;
  if (Math.abs(diffPercentagePoints) <= config.institutionalTrend.flatBandPercent) {
    return { trend: "flat", availability: "可得" };
  }
  return { trend: diffPercentagePoints > 0 ? "up" : "down", availability: "可得" };
}

/** Appends today's snapshot, deduped by calendar day (re-running the pipeline multiple times in one day updates, not duplicates, that day's entry). */
export function appendSnapshot(history: InstitutionalSnapshot[], institutionsPercentHeld: number, now: Date = new Date()): InstitutionalSnapshot[] {
  const today = now.toISOString().slice(0, 10);
  const withoutToday = history.filter((h) => h.asOf !== today);
  return [...withoutToday, { asOf: today, institutionsPercentHeld }];
}
