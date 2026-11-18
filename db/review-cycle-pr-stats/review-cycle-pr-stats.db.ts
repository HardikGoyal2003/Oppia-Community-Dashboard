import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import {
  FIRESTORE_READ_CHUNK_SIZE,
  FIRESTORE_WRITE_BATCH_SIZE,
} from "@/db/utils/batch.utils";
import {
  normalizeReviewCyclePrStats,
  serializeReviewCyclePrStats,
  type ReviewCyclePrStatsDocument,
} from "./review-cycle-pr-stats.mapper";

const db = getAdminFirestore();
const collection = db.collection(DB_PATHS.REVIEW_CYCLE_PR_STATS.COLLECTION);

/**
 * Reads PR stats documents for the supplied PR numbers.
 *
 * @param prNumbers The PR numbers to read.
 * @returns PR stats keyed by PR number. Missing documents are omitted.
 */
export async function getReviewCyclePrStats(
  prNumbers: number[],
): Promise<Map<number, ReviewCyclePrStatsDocument>> {
  const result = new Map<number, ReviewCyclePrStatsDocument>();
  if (prNumbers.length === 0) return result;

  const unique = Array.from(new Set(prNumbers));

  for (
    let start = 0;
    start < unique.length;
    start += FIRESTORE_READ_CHUNK_SIZE
  ) {
    const chunk = unique.slice(start, start + FIRESTORE_READ_CHUNK_SIZE);
    const snapshots = await db.getAll(
      ...chunk.map((prNumber) => collection.doc(String(prNumber))),
    );

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data();
      if (snapshot.exists && data) {
        result.set(chunk[index], normalizeReviewCyclePrStats(data));
      }
    });
  }

  return result;
}

/**
 * Writes PR stats documents in chunks.
 *
 * @param documents The PR stats to persist.
 * @returns A promise that resolves after every chunk is written.
 */
export async function upsertReviewCyclePrStats(
  documents: Array<Omit<ReviewCyclePrStatsDocument, "schemaVersion">>,
): Promise<void> {
  for (
    let start = 0;
    start < documents.length;
    start += FIRESTORE_WRITE_BATCH_SIZE
  ) {
    const batch = collection.firestore.batch();

    for (const document of documents.slice(
      start,
      start + FIRESTORE_WRITE_BATCH_SIZE,
    )) {
      batch.set(
        collection.doc(String(document.prNumber)),
        serializeReviewCyclePrStats(document),
      );
    }

    await batch.commit();
  }
}

/**
 * Reads the most recently created PR stats documents.
 *
 * @param limit Maximum number of documents to read.
 * @returns PR stats ordered by descending PR number.
 */
export async function getRecentReviewCyclePrStats(
  limit: number,
): Promise<ReviewCyclePrStatsDocument[]> {
  const snapshot = await collection
    .orderBy("prNumber", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => normalizeReviewCyclePrStats(doc.data()));
}
