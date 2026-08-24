import type { EventWindowConfig, EventWindowEntry } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * TASK_CARD_03_PATCH SCOPE Part B. Extends CARD 03's earningsSoon flag
 * (a fixed 14-day yes/no) into a full event_window list: every known,
 * schedule-certain future event within windowDays (config-driven,
 * default 180 - the outer bound of all 3 legal holding-period windows;
 * Layer 1 doesn't commit to a single timeframe per symbol, see
 * ai/decisions.md).
 *
 * Only 'earnings' is ever populated in this implementation:
 * - lockup_expiry: verified live (grepped yahoo-finance2's full type
 *   definitions) that it has zero lockup/IPO-related fields. Deriving
 *   an assumed expiry date from firstTradeDate + a guessed standard
 *   lockup length would fabricate a specific date this system doesn't
 *   actually know (real lockup terms vary by company and can have
 *   early-release provisions) - deliberately not done. SCOPE's own "若
 *   IPO标的,profile可得则算" anticipates this may not be available.
 * - shareholder_meeting / product_launch: no configured data source
 *   (would need e.g. Finnhub, no API key present) - SCOPE's own "尽力
 *   而为,不可得则跳过" explicitly permits skipping.
 *
 * 边界硬编码: only ever registers a scheduled date; never predicts an
 * event's outcome or a non-scheduled (e.g. surprise news) event.
 */
export function computeEventWindow(
  earningsDate: string | undefined,
  now: Date,
  config: EventWindowConfig,
): EventWindowEntry[] {
  const events: EventWindowEntry[] = [];

  if (earningsDate) {
    const daysUntil = Math.round((new Date(`${earningsDate}T00:00:00Z`).getTime() - now.getTime()) / DAY_MS);
    if (daysUntil >= 0 && daysUntil <= config.eventWindow.windowDays) {
      events.push({ type: "earnings", date: earningsDate, daysUntil });
    }
  }

  return events;
}
