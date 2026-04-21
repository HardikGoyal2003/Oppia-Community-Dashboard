import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
  DerivedJourneyKey,
  DerivedProgressState,
  UserJourneyProgressModel,
} from "@/lib/domain/contributor-journey.types";
import { DB_PATHS } from "@/db/db-paths";
import { getRequiredDocumentRef } from "@/db/utils/document.utils";
import {
  FirestoreUserJourneyProgress,
  normalizeUserJourneyProgressDocument,
  serializeUserJourneyProgress,
} from "./user-journey-progress.mapper";

const db = getAdminFirestore();
const userJourneyProgressCollection = db.collection(
  DB_PATHS.USER_JOURNEY_PROGRESS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreUserJourneyProgress>;

/**
 * Resolves a user journey progress document reference and guarantees it exists.
 *
 * @param uid The user id whose journey progress document is required.
 * @returns The existing journey progress document reference.
 */
async function getRequiredJourneyProgressDocRefByUid(
  uid: string,
): Promise<FirebaseFirestore.DocumentReference<FirestoreUserJourneyProgress>> {
  return getRequiredDocumentRef(
    "User journey progress",
    userJourneyProgressCollection.doc(uid),
  );
}

/**
 * Retrieves stored user journey progress by uid.
 *
 * @param uid The user id to fetch.
 * @returns The normalized journey progress model, or null when no document exists.
 */
export async function getUserJourneyProgressByUid(
  uid: string,
): Promise<UserJourneyProgressModel | null> {
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
  progress: UserJourneyProgressModel,
): Promise<void> {
  await userJourneyProgressCollection
    .doc(uid)
    .set(serializeUserJourneyProgress(progress));
}

/**
 * Updates the tracked platform value for a user's journey progress document.
 *
 * @param uid The user id to update.
 * @param platform The platform to persist.
 * @returns A promise that resolves when the write finishes.
 */
export async function updateUserJourneyPlatformByUid(
  uid: string,
  platform: ContributionPlatform,
): Promise<void> {
  const docRef = await getRequiredJourneyProgressDocRefByUid(uid);

  await docRef.update({
    platform,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Marks a manual journey item as completed once. Existing completion is preserved.
 *
 * @param uid The user id to update.
 * @param itemId The stable manual item id to mark complete.
 * @returns A promise that resolves when the write finishes.
 */
export async function markManualJourneyItemCompletedByUid(
  uid: string,
  itemId: string,
): Promise<void> {
  const docRef = await getRequiredJourneyProgressDocRefByUid(uid);

  await userJourneyProgressCollection.firestore.runTransaction(
    async (transaction) => {
      const snap = await transaction.get(docRef);
      const progress = normalizeUserJourneyProgressDocument(snap.data()!);
      const currentState = progress.manualProgress[itemId];

      if (currentState?.completed) {
        return;
      }

      progress.manualProgress[itemId] = {
        completed: true,
        completedAt: new Date(),
      };
      progress.updatedAt = new Date();

      transaction.set(docRef, serializeUserJourneyProgress(progress));
    },
  );
}

/**
 * Persists derived journey progress for a specific derived milestone key.
 *
 * @param uid The user id to update.
 * @param key The derived journey key to update.
 * @param state The derived progress state to persist.
 * @returns A promise that resolves when the write finishes.
 */
export async function setDerivedJourneyStateByUid(
  uid: string,
  key: DerivedJourneyKey,
  state: DerivedProgressState,
): Promise<void> {
  const docRef = await getRequiredJourneyProgressDocRefByUid(uid);

  await docRef.update({
    [`derivedState.${key}`]: {
      completed: state.completed,
      completedAt: state.completed
        ? Timestamp.fromDate(state.completedAt ?? new Date())
        : null,
      sourceUrl: state.sourceUrl,
    },
    updatedAt: Timestamp.now(),
  });
}
