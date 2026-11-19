import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import { buildReviewCyclePrStatsDocId } from "@/db/reviewer-doc-ids";
import {
  FIRESTORE_READ_CHUNK_SIZE,
  FIRESTORE_WRITE_BATCH_SIZE,
} from "@/db/utils/batch.utils";
import {
  normalizeReviewCyclePrStats,
  serializeReviewCyclePrStats,
  type FirestoreReviewCyclePrStats,
  type ReviewCyclePrStatsDocument,
} from "./review-cycle-pr-stats.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEW_CYCLE_PR_STATS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewCyclePrStats>;

/**
 * Reads PR stats documents for the supplied PR numbers.
 *
 * @param platform The repository platform the PRs belong to.
 * @param prNumbers The PR numbers to read.
 * @returns PR stats keyed by PR number. Missing documents are omitted.
 */
export async function getReviewCyclePrStats(
  platform: ContributionPlatform,
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
    const snapshots = await collection.firestore.getAll(
      ...chunk.map((prNumber) =>
        collection.doc(buildReviewCyclePrStatsDocId(platform, prNumber)),
      ),
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
 * @param platform The repository platform the PRs belong to.
 * @param documents The PR stats to persist.
 * @returns A promise that resolves after every chunk is written.
 */
export async function upsertReviewCyclePrStats(
  platform: ContributionPlatform,
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
        collection.doc(
          buildReviewCyclePrStatsDocId(platform, document.prNumber),
        ),
        serializeReviewCyclePrStats(document),
      );
    }

    await batch.commit();
  }
}

/**
 * Reads the most recently created PR stats documents.
 *
 * @firestore-index reviewCyclePrStats platform, prNumber
 * @param platform The repository platform the PRs belong to.
 * @param limit Maximum number of documents to read.
 * @returns PR stats for the platform ordered by descending PR number.
 */
export async function getRecentReviewCyclePrStats(
  platform: ContributionPlatform,
  limit: number,
): Promise<ReviewCyclePrStatsDocument[]> {
  const snapshot = await collection
    .where("platform", "==", platform)
    .orderBy("prNumber", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => normalizeReviewCyclePrStats(doc.data()));
}
