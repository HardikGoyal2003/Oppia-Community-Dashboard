import type { ContributionPlatform } from "@/lib/auth/auth.types";

/**
 * Builds the Firestore document id for a reviewer.
 *
 * The platform prefix keeps reviewers from different repositories from
 * overwriting each other when a contributor reviews on both platforms.
 *
 * @param platform The contribution platform.
 * @param login The GitHub login of the reviewer.
 * @returns The reviewer document id.
 */
export function buildReviewerDocId(
  platform: ContributionPlatform,
  login: string,
): string {
  return `${platform}_${login}`;
}

/**
 * Builds the Firestore document id for a reviewer cycle aggregate.
 *
 * @param platform The contribution platform.
 * @param login The GitHub login of the reviewer.
 * @returns The aggregate document id.
 */
export function buildReviewerCycleAggregateDocId(
  platform: ContributionPlatform,
  login: string,
): string {
  return `${platform}_${login}`;
}

/**
 * Builds the Firestore document id for a review cycle.
 *
 * @param platform The contribution platform.
 * @param login The GitHub login of the reviewer.
 * @param prNumber The pull request number.
 * @param assignedAt The assignment timestamp.
 * @returns The review-cycle document id.
 */
export function buildReviewCycleDocId(
  platform: ContributionPlatform,
  login: string,
  prNumber: number,
  assignedAt: string,
): string {
  return `${platform}_${login}:${prNumber}:${assignedAt}`;
}

/**
 * Builds the Firestore document id for per-PR review stats.
 *
 * PR numbers are only unique within a repository, so the platform is part of
 * the key.
 *
 * @param platform The contribution platform.
 * @param prNumber The pull request number.
 * @returns The PR stats document id.
 */
export function buildReviewCyclePrStatsDocId(
  platform: ContributionPlatform,
  prNumber: number,
): string {
  return `${platform}_${prNumber}`;
}

/**
 * Builds the Firestore document id for a month's reviewer membership.
 *
 * @param platform The contribution platform.
 * @param month The `YYYY-MM` month key.
 * @returns The monthly reviewers document id.
 */
export function buildReviewCycleMonthlyReviewersDocId(
  platform: ContributionPlatform,
  month: string,
): string {
  return `${platform}_${month}`;
}

/**
 * Builds the Firestore document id for the analytics snapshot.
 *
 * @param platform The contribution platform.
 * @returns The analytics snapshot document id.
 */
export function buildReviewCycleAnalyticsDocId(
  platform: ContributionPlatform,
): string {
  return platform;
}

/**
 * Builds the Firestore document id for the backfill checkpoint.
 *
 * @param platform The contribution platform.
 * @returns The backfill state document id.
 */
export function buildReviewCycleBackfillDocId(
  platform: ContributionPlatform,
): string {
  return platform;
}
