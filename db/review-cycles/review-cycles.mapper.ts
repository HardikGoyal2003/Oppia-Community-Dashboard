import type { ReviewCycleRecord } from "@/lib/domain/reviewer-teams.types";

export type FirestoreReviewCycle = ReviewCycleRecord;

/**
 * Serializes a review cycle record for Firestore storage.
 *
 * @param record The review cycle record to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCycle(
  record: ReviewCycleRecord,
): FirestoreReviewCycle {
  return { ...record };
}
