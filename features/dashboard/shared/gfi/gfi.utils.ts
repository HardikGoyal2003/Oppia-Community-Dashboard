import type { TeamGfiCounts } from "@/lib/domain/teams.types";

/** Healthy pool size that each team should keep open for new contributors. */
export const MINIMUM_GFI_POOL_SIZE = 15;

/**
 * Sums the stored GFI counts into the single pool size shown to leads.
 *
 * @param counts The stored GFI counts for a team.
 * @returns The total number of open good first issues.
 */
export function getTotalGfiCount(counts: TeamGfiCounts): number {
  return (
    counts.backend + counts.frontend + counts.fullstack + counts.uncategorized
  );
}

/**
 * Resolves the health label for a team's GFI pool size.
 *
 * @param total The total number of open good first issues.
 * @returns A short label describing the pool health.
 */
export function getGfiPoolStatusLabel(total: number): string {
  if (total >= MINIMUM_GFI_POOL_SIZE) {
    return "Healthy pipeline";
  }

  if (total >= 8) {
    return "Needs growth";
  }

  return "Low stock";
}
