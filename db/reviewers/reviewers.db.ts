import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ReviewerDocument } from "@/lib/domain/reviewer-teams.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  FIRESTORE_READ_CHUNK_SIZE,
  FIRESTORE_WRITE_BATCH_SIZE,
} from "@/db/utils/batch.utils";
import {
  type FirestoreReviewer,
  normalizeReviewer,
  serializeReviewer,
} from "./reviewers.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEWERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewer>;

/**
 * Stores or replaces a reviewer document for the given login.
 *
 * @param login The GitHub login of the reviewer.
 * @param doc The reviewer document to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function upsertReviewer(
  login: string,
  doc: Omit<ReviewerDocument, "schemaVersion">,
): Promise<void> {
  await collection.doc(login).set(serializeReviewer(doc));
}

/**
 * Stores or replaces many reviewer documents using batched writes.
 *
 * @param entries The reviewer logins and documents to persist.
 * @returns A promise that resolves when all batch writes complete.
 */
export async function upsertReviewers(
  entries: Array<{
    login: string;
    doc: Omit<ReviewerDocument, "schemaVersion">;
  }>,
): Promise<void> {
  for (
    let start = 0;
    start < entries.length;
    start += FIRESTORE_WRITE_BATCH_SIZE
  ) {
    const batch = collection.firestore.batch();

    for (const { login, doc } of entries.slice(
      start,
      start + FIRESTORE_WRITE_BATCH_SIZE,
    )) {
      batch.set(collection.doc(login), serializeReviewer(doc));
    }

    await batch.commit();
  }
}

/**
 * Retrieves reviewer documents for the given logins.
 *
 * Uses `getAll` so a targeted refresh reads only the affected reviewers
 * instead of the whole collection.
 *
 * @param logins The GitHub logins to fetch.
 * @returns A map of login to reviewer document for the logins that exist.
 */
export async function getReviewers(
  logins: string[],
): Promise<Map<string, ReviewerDocument>> {
  const uniqueLogins = Array.from(new Set(logins));
  const reviewers = new Map<string, ReviewerDocument>();

  for (
    let start = 0;
    start < uniqueLogins.length;
    start += FIRESTORE_READ_CHUNK_SIZE
  ) {
    const chunk = uniqueLogins.slice(start, start + FIRESTORE_READ_CHUNK_SIZE);
    const snapshots = await collection.firestore.getAll(
      ...chunk.map((login) => collection.doc(login)),
    );

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      if (snapshot.exists && data) {
        reviewers.set(chunk[index], normalizeReviewer(data));
      }
    });
  }

  return reviewers;
}
