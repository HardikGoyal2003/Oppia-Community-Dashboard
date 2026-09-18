import type { ReviewCycleRecord } from "@/lib/domain/reviewer-teams.types";

export type FirestoreReviewCycle = ReviewCycleRecord;

/**
 * Normalizes a raw Firestore review cycle document into the app model.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized review cycle record.
 */
export function normalizeReviewCycle(
  data: FirebaseFirestore.DocumentData,
): ReviewCycleRecord {
  return {
    reviewerLogin: data.reviewerLogin as string,
    prNumber: data.prNumber as number,
    prTitle: data.prTitle as string,
    prUrl: data.prUrl as string,
    assignedAt: data.assignedAt as string,
    completedAt: data.completedAt as string,
    durationMs: data.durationMs as number,
    reviewRoundsBeforeApproval:
      (data.reviewRoundsBeforeApproval as number | null) ?? null,
    commentCount: (data.commentCount as number) ?? 0,
  };
}

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
