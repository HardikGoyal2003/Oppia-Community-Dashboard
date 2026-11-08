/** Healthy pool size that each team should keep open for new contributors. */
export const MINIMUM_GFI_POOL_SIZE = 15;

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
