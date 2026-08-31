import type { FredObservation } from "./types.js";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

/**
 * FRED's own documented response shape (fred.stlouisfed.org/docs/api/fred/series_observations.html,
 * WebSearch-verified during TASK_CARD_08 - no live FRED_API_KEY available in
 * this environment to verify against a real call, same disclosed residual-
 * risk pattern as src/data/enrich/fmpClient.ts's field names): a top-level
 * `observations` array of `{ date, value }`, where `value` is a STRING and
 * uses the literal "." to mark a missing print (holiday/no data) rather than
 * omitting the field.
 */
export function parseFredObservations(raw: unknown): FredObservation[] | null {
  if (!raw || typeof raw !== "object" || !("observations" in raw)) return null;
  const obs = (raw as { observations: unknown }).observations;
  if (!Array.isArray(obs)) return null;
  return obs.map((o) => {
    const rec = o as Record<string, unknown>;
    const rawValue = typeof rec.value === "string" ? rec.value : null;
    const parsed = rawValue !== null && rawValue !== "." ? Number(rawValue) : NaN;
    return { date: String(rec.date), value: Number.isFinite(parsed) ? parsed : null };
  });
}

/**
 * Fetches a FRED series' observation history. Degrades to null (never
 * throws) when no key is configured or the request fails - callers must
 * treat null as "不可得" and run the rest of the pipeline unblocked, per
 * TASK_CARD_08's circuit-breaker rule.
 */
export async function fetchFredSeries(
  seriesId: string,
  apiKey: string | undefined,
  observationStart?: string,
): Promise<FredObservation[] | null> {
  if (!apiKey) return null;
  const params = new URLSearchParams({ series_id: seriesId, api_key: apiKey, file_type: "json" });
  if (observationStart) params.set("observation_start", observationStart);

  let res: Response;
  try {
    res = await fetch(`${FRED_BASE}?${params.toString()}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  return parseFredObservations(data);
}
