import { existsSync } from "node:fs";

/**
 * Every run's artifacts live under {baseDir}/{YYYY-MM-DD}/. The first run
 * of a calendar day gets the bare date folder; a second (or later) run the
 * same day gets a {HHMM} suffix (from the same runTimestamp, UTC -
 * consistent with how the rest of this codebase already treats
 * timestamps) so same-day runs never collide or overwrite each other.
 * `baseDir` defaults to "output/runs" and exists as a parameter only so
 * tests can point this at an isolated temp directory.
 */
export function resolveRunFolder(runTimestamp: string, baseDir = "output/runs"): string {
  const date = runTimestamp.slice(0, 10);
  const bareFolder = `${baseDir}/${date}`;
  if (!existsSync(bareFolder)) return bareFolder;
  const hhmm = runTimestamp.slice(11, 13) + runTimestamp.slice(14, 16);
  return `${bareFolder}_${hhmm}`;
}
