import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import { buildReviewCycleMonthlyReviewersDocId } from "@/db/reviewer-doc-ids";
import {
  FIRESTORE_READ_CHUNK_SIZE,
  FIRESTORE_WRITE_BATCH_SIZE,
} from "@/db/utils/batch.utils";
import {
  normalizeReviewCycleMonthlyReviewers,
  serializeReviewCycleMonthlyReviewers,
  type FirestoreReviewCycleMonthlyReviewers,
  type ReviewCycleMonthlyReviewersDocument,
} from "./review-cycle-monthly-reviewers.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEW_CYCLE_MONTHLY_REVIEWERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewCycleMonthlyReviewers>;

/**
 * Writes monthly reviewer documents in chunks.
 *
 * @param platform The repository platform the reviewers belong to.
 * @param documents The monthly documents to persist.
 * @returns A promise that resolves after every chunk is written.
 */
export async function upsertReviewCycleMonthlyReviewers(
  platform: ContributionPlatform,
  documents: Array<Omit<ReviewCycleMonthlyReviewersDocument, "schemaVersion">>,
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
          buildReviewCycleMonthlyReviewersDocId(platform, document.month),
        ),
        serializeReviewCycleMonthlyReviewers(document),
      );
    }

    await batch.commit();
  }
}

/**
 * Reads monthly reviewer documents for the supplied month keys.
 *
 * @param platform The repository platform the reviewers belong to.
 * @param months The month keys to read.
 * @returns Monthly reviewers keyed by month. Missing months are omitted.
 */
export async function getReviewCycleMonthlyReviewers(
  platform: ContributionPlatform,
  months: string[],
): Promise<Map<string, ReviewCycleMonthlyReviewersDocument>> {
  const result = new Map<string, ReviewCycleMonthlyReviewersDocument>();
  if (months.length === 0) return result;

  const unique = Array.from(new Set(months));

  for (
    let start = 0;
    start < unique.length;
    start += FIRESTORE_READ_CHUNK_SIZE
  ) {
    const chunk = unique.slice(start, start + FIRESTORE_READ_CHUNK_SIZE);
    const snapshots = await collection.firestore.getAll(
      ...chunk.map((month) =>
        collection.doc(buildReviewCycleMonthlyReviewersDocId(platform, month)),
      ),
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
