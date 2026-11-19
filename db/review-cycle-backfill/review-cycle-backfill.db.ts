import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DbValidationError } from "@/db/db.errors";
import { logDbError } from "@/db/db-logger";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { ReviewCycleBackfillState } from "@/lib/domain/review-cycle-backfill.types";
import { DB_PATHS } from "@/db/db-paths";
import { buildReviewCycleBackfillDocId } from "@/db/reviewer-doc-ids";
import {
  type FirestoreReviewCycleBackfillState,
  normalizeReviewCycleBackfillState,
  serializeReviewCycleBackfillState,
} from "./review-cycle-backfill.mapper";

const db = getAdminFirestore();

/**
 * Returns the checkpoint document for a platform.
 *
 * @param platform The repository platform the backfill belongs to.
 * @returns The platform-scoped backfill state document reference.
 */
function getStateDoc(
  platform: ContributionPlatform,
): FirebaseFirestore.DocumentReference<FirestoreReviewCycleBackfillState> {
  return db
    .collection(DB_PATHS.REVIEW_CYCLE_BACKFILL.COLLECTION)
    .doc(
      buildReviewCycleBackfillDocId(platform),
    ) as FirebaseFirestore.DocumentReference<FirestoreReviewCycleBackfillState>;
}

/**
 * Reads the persisted backfill progress, if a backfill is in flight.
 *
 * Validation failures are logged and rethrown so incompatible or corrupt
 * checkpoints are not silently discarded.
 *
 * @param platform The repository platform the backfill belongs to.
 * @returns The stored backfill state, or null when none exists.
 */
export async function getReviewCycleBackfillState(
  platform: ContributionPlatform,
): Promise<ReviewCycleBackfillState | null> {
  const snapshot = await getStateDoc(platform).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;

  try {
    return normalizeReviewCycleBackfillState(data);
  } catch (error) {
    if (error instanceof DbValidationError) {
      logDbError("Failed to read review cycle backfill state.", error);
    }
    throw error;
  }
}

/**
 * Persists backfill progress so the next run can resume where this one stopped.
 *
 * @param platform The repository platform the backfill belongs to.
 * @param state The progress to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function saveReviewCycleBackfillState(
  platform: ContributionPlatform,
  state: Omit<ReviewCycleBackfillState, "schemaVersion">,
): Promise<void> {
  await getStateDoc(platform).set(serializeReviewCycleBackfillState(state));
}

/**
 * Removes stored backfill progress once the backfill has finished.
 *
 * @param platform The repository platform the backfill belongs to.
 * @returns A promise that resolves when the document is deleted.
 */
export async function clearReviewCycleBackfillState(
  platform: ContributionPlatform,
): Promise<void> {
  await getStateDoc(platform).delete();
}
