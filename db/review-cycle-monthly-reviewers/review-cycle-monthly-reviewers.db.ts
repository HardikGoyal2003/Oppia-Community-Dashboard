import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import {
  normalizeReviewCycleMonthlyReviewers,
  serializeReviewCycleMonthlyReviewers,
  type ReviewCycleMonthlyReviewersDocument,
} from "./review-cycle-monthly-reviewers.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEW_CYCLE_MONTHLY_REVIEWERS.COLLECTION,
);

/** Firestore `getAll` works best in modest chunks. */
const READ_CHUNK_SIZE = 300;

/**
 * Firestore caps a single batch at 500 writes, so multi-document writes are
 * committed in chunks with some headroom.
 */
const BATCH_SIZE = 400;

/**
 * Writes monthly reviewer documents in chunks.
 *
 * @param documents The monthly documents to persist.
 * @returns A promise that resolves after every chunk is written.
 */
export async function upsertReviewCycleMonthlyReviewers(
  documents: Array<Omit<ReviewCycleMonthlyReviewersDocument, "schemaVersion">>,
): Promise<void> {
  for (let start = 0; start < documents.length; start += BATCH_SIZE) {
    const batch = collection.firestore.batch();

    for (const document of documents.slice(start, start + BATCH_SIZE)) {
      batch.set(
        collection.doc(document.month),
        serializeReviewCycleMonthlyReviewers(document),
      );
    }

    await batch.commit();
  }
}

/**
 * Reads monthly reviewer documents for the supplied month keys.
 *
 * @param months The month keys to read.
 * @returns Monthly reviewers keyed by month. Missing months are omitted.
 */
export async function getReviewCycleMonthlyReviewers(
  months: string[],
): Promise<Map<string, ReviewCycleMonthlyReviewersDocument>> {
  const result = new Map<string, ReviewCycleMonthlyReviewersDocument>();
  if (months.length === 0) return result;

  const unique = Array.from(new Set(months));

  for (let start = 0; start < unique.length; start += READ_CHUNK_SIZE) {
    const chunk = unique.slice(start, start + READ_CHUNK_SIZE);
    const snapshots = await db.getAll(
      ...chunk.map((month) => collection.doc(month)),
    );

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      if (snapshot.exists && data) {
        result.set(chunk[index], normalizeReviewCycleMonthlyReviewers(data));
      }
    });
  }

  return result;
}
