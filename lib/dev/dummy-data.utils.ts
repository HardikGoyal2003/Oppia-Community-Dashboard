/**
 * Builds a deterministic snapshot timestamp for a sample day offset.
 *
 * @param daysAgo The number of days before today to target.
 * @returns The fixed snapshot timestamp for that sample day.
 */
export function getFixedIstCaptureDate(daysAgo: number): Date {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() - daysAgo);

  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      target.getUTCDate(),
      6,
      30,
      0,
      0,
    ),
  );
}
