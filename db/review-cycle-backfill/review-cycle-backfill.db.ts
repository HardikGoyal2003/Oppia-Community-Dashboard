import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DbValidationError } from "@/db/db.errors";
import type { ReviewCycleBackfillState } from "@/lib/domain/review-cycle-backfill.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreReviewCycleBackfillState,
  normalizeReviewCycleBackfillState,
  serializeReviewCycleBackfillState,
} from "./review-cycle-backfill.mapper";

const db = getAdminFirestore();
const stateDoc = db
  .collection(DB_PATHS.REVIEW_CYCLE_BACKFILL.COLLECTION)
  .doc(
    DB_PATHS.REVIEW_CYCLE_BACKFILL.STATE_DOC,
  ) as FirebaseFirestore.DocumentReference<FirestoreReviewCycleBackfillState>;

/**
 * Reads the persisted backfill progress, if a backfill is in flight.
 *
 * A state document written by an older, incompatible shape is discarded so a
 * stale checkpoint can never block the job.
 *
 * @returns The stored backfill state, or null when none exists.
 */
export async function getReviewCycleBackfillState(): Promise<ReviewCycleBackfillState | null> {
  const snapshot = await stateDoc.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;

  try {
    return normalizeReviewCycleBackfillState(data);
  } catch (error) {
    if (error instanceof DbValidationError) {
      await stateDoc.delete();
      return null;
    }
    throw error;
  }
}

/**
 * Persists backfill progress so the next run can resume where this one stopped.
 *
 * @param state The progress to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function saveReviewCycleBackfillState(
  state: ReviewCycleBackfillState,
): Promise<void> {
  await stateDoc.set(serializeReviewCycleBackfillState(state));
}

/**
 * Removes stored backfill progress once the backfill has finished.
 *
 * @returns A promise that resolves when the document is deleted.
 */
export async function clearReviewCycleBackfillState(): Promise<void> {
  await stateDoc.delete();
}
