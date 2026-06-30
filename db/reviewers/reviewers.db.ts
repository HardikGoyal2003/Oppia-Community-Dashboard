import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ReviewerDocument } from "@/lib/domain/reviewer-teams.types";
import { DB_PATHS } from "@/db/db-paths";
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
 * Retrieves a reviewer document by GitHub login.
 *
 * @param login The GitHub login of the reviewer.
 * @returns The reviewer document, or null if not found.
 */
export async function getReviewer(
  login: string,
): Promise<ReviewerDocument | null> {
  const snapshot = await collection.doc(login).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;
  return normalizeReviewer(data);
}

/**
 * Stores or replaces a reviewer document for the given login.
 *
 * @param login The GitHub login of the reviewer.
 * @param doc The reviewer document to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function upsertReviewer(
  login: string,
  doc: ReviewerDocument,
): Promise<void> {
  await collection.doc(login).set(serializeReviewer(doc));
}

/**
 * Returns the set of all reviewer login keys in the collection.
 *
 * Only reads document IDs — no field data is fetched.
 *
 * @returns A set of reviewer logins (doc IDs).
 */
export async function getAllReviewerLogins(): Promise<Set<string>> {
  const snapshot = await collection.select().get();
  const logins = new Set<string>();
  snapshot.forEach((doc) => logins.add(doc.id));
  return logins;
}

/**
 * Fetches all reviewer documents from Firestore.
 *
 * @returns A promise that resolves to a map of login to reviewer document.
 */
export async function getAllReviewers(): Promise<
  Map<string, ReviewerDocument>
> {
  const snapshot = await collection.get();
  const map = new Map<string, ReviewerDocument>();
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data) {
      map.set(doc.id, normalizeReviewer(data));
    }
  });
  return map;
}
