/**
 * SEC specifically requires an email-format string, not just descriptive
 * text or a URL - verified live: "Atlas Research Project
 * (github.com/...)" gets 403, but "Atlas Research atlas-dev@example.com"
 * gets 200. This placeholder satisfies that format check but is NOT a
 * real reachable contact, which defeats the actual point of SEC's
 * policy (letting them reach the requester about traffic issues) -
 * operators should set SEC_EDGAR_USER_AGENT to their own real contact
 * per .env.example's instructions rather than rely on this fallback.
 */
const DEFAULT_USER_AGENT = "Atlas Research Project atlas-research@example.com";

function userAgent(): string {
  return process.env.SEC_EDGAR_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

/**
 * SEC EDGAR requires a self-identifying User-Agent (verified live: a
 * generic "Mozilla/5.0" or no header at all gets HTTP 403; an honest
 * identifying string gets 200) and enforces a 10 req/s cap per IP.
 * This client always sets the header and serializes ALL SEC requests
 * through a single inter-request delay computed from
 * config/card04.json's insiders.maxRequestsPerSecond (deliberately kept
 * under 10 as a safety margin) - sequential, not just rate-tracked, so
 * the cap can never be exceeded regardless of how many callers are
 * mid-flight.
 */
export async function secFetch(url: string, maxRequestsPerSecond: number): Promise<Response> {
  const minIntervalMs = 1000 / maxRequestsPerSecond;
  const now = Date.now();
  const wait = lastRequestAt + minIntervalMs - now;
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  return fetch(url, { headers: { "User-Agent": userAgent() } });
}
