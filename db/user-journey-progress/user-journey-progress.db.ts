import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type {
  DerivedJourneyKey,
  DerivedProgressState,
  UserJourneyProgressModel,
} from "@/lib/domain/contributor-journey.types";
import { DERIVED_JOURNEY_KEYS } from "@/lib/domain/contributor-journey.types";
import { DB_PATHS } from "@/db/db-paths";
import { DbValidationError } from "@/db/db.errors";
import {
  getRequiredTransactionDocumentSnapshot,
  updateRequiredDocument,
} from "@/db/utils/document.utils";
import {
  FirestoreUserJourneyProgress,
  normalizeUserJourneyProgressDocument,
  serializeDerivedJourneyStateUpdate,
  serializeUserJourneyProgress,
} from "./user-journey-progress.mapper";

/**
 * Validates that a Firestore document id input is a non-empty string.
 *
 * @param field The field name being validated.
 * @param value The id value to validate.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertNonEmptyId(field: string, value: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new DbValidationError(field, `${field} must be a non-empty string.`);
  }
}

/**
 * Validates that a derived journey key is allowlisted.
 *
 * @param key The derived journey key to validate.
 * @returns Nothing. Throws when the key is not supported.
 */
function assertDerivedJourneyKey(
  key: string,
): asserts key is DerivedJourneyKey {
  if (!DERIVED_JOURNEY_KEYS.includes(key as DerivedJourneyKey)) {
    throw new DbValidationError(
      "key",
      "Derived journey key must be a supported value.",
    );
  }
}

const db = getAdminFirestore();
const userJourneyProgressCollection = db.collection(
  DB_PATHS.USER_JOURNEY_PROGRESS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreUserJourneyProgress>;

/**
 * Retrieves stored user journey progress by uid.
 *
 * @param uid The user id to fetch.
 * @returns The normalized journey progress model, or null when no document exists.
 */
export async function getUserJourneyProgressByUid(
  uid: string,
): Promise<UserJourneyProgressModel | null> {
  assertNonEmptyId("uid", uid);
  const snap = await userJourneyProgressCollection.doc(uid).get();

  if (!snap.exists) {
    return null;
  }

  return normalizeUserJourneyProgressDocument(snap.data()!);
}

/**
 * Creates or overwrites a user journey progress document.
 *
 * @param uid The user id to persist under.
 * @param progress The normalized journey progress model.
 * @returns A promise that resolves when the write finishes.
 */
export async function saveUserJourneyProgressByUid(
  uid: string,
  progress: Omit<UserJourneyProgressModel, "schemaVersion">,
): Promise<void> {
  assertNonEmptyId("uid", uid);
  await userJourneyProgressCollection
    .doc(uid)
    .set(serializeUserJourneyProgress(progress));
}

/**
 * Marks a manual journey item as completed once. Existing completion is preserved.
 *
 * @param uid The user id to update.
 * @param itemId The stable manual item id to mark complete.
 * @returns The persisted journey progress model after the write attempt.
 */
export async function markManualJourneyItemCompletedByUid(
  uid: string,
  itemId: string,
): Promise<UserJourneyProgressModel> {
  assertNonEmptyId("uid", uid);
  assertNonEmptyId("itemId", itemId);
  const docRef = userJourneyProgressCollection.doc(uid);

  return userJourneyProgressCollection.firestore.runTransaction(
    async (transaction) => {
      const snap = await getRequiredTransactionDocumentSnapshot(
        transaction,
        "User journey progress",
        docRef,
      );
      const progress = normalizeUserJourneyProgressDocument(snap.data()!);
      const currentState = progress.manualProgress[itemId];

      if (currentState?.completed) {
        return progress;
      }

      const completedAt = new Date();
      const updatedAt = new Date();

      progress.manualProgress[itemId] = {
        completed: true,
        completedAt,
      };
      progress.updatedAt = updatedAt;

      transaction.set(docRef, serializeUserJourneyProgress(progress));

      return progress;
    },
  );
}

/**
 * Persists derived journey progress for a specific derived milestone key.
 *
 * @param uid The user id to update.
 * @param key The derived journey key to update.
 * @param state The derived progress state to persist.
 * @returns The persisted derived progress state and document update timestamp.
 */
export async function setDerivedJourneyStateByUid(
  uid: string,
  key: DerivedJourneyKey,
  state: DerivedProgressState,
): Promise<{ state: DerivedProgressState; updatedAt: Date }> {
  assertNonEmptyId("uid", uid);
  assertDerivedJourneyKey(key);
  const updatedAt = new Date();

  await updateRequiredDocument(
    "User journey progress",
    userJourneyProgressCollection.doc(uid),
    serializeDerivedJourneyStateUpdate(key, state, updatedAt),
  );

  return { state, updatedAt };
}
