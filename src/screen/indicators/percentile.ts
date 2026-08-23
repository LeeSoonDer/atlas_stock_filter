/**
 * Percentile rank of `target` within `population` (0..100): the share of
 * population values that are <= target. `population` should include
 * `target` itself if it is a member of the same series being ranked.
 */
export function percentileRank(population: number[], target: number): number | null {
  if (population.length === 0) return null;
  const countLessOrEqual = population.filter((v) => v <= target).length;
  return (countLessOrEqual / population.length) * 100;
}
