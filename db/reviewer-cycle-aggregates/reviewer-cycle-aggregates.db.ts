import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import { FIRESTORE_WRITE_BATCH_SIZE } from "@/db/utils/batch.utils";
import {
  normalizeReviewerCycleAggregate,
  serializeReviewerCycleAggregate,
  type FirestoreReviewerCycleAggregate,
  type ReviewerCycleAggregateDocument,
} from "./reviewer-cycle-aggregates.mapper";

type ReviewerCycleAggregateWrite = Omit<
  ReviewerCycleAggregateDocument,
  "schemaVersion"
>;

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEWER_CYCLE_AGGREGATES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewerCycleAggregate>;

/**
 * Reads aggregate documents for the supplied reviewer logins.
 * @param logins Reviewer logins to read.
 * @returns Aggregates keyed by login.
 */
export async function getReviewerCycleAggregates(
  logins: string[],
): Promise<Map<string, ReviewerCycleAggregateDocument>> {
  const result = new Map<string, ReviewerCycleAggregateDocument>();
  if (logins.length === 0) return result;
  const snapshots = await collection.firestore.getAll(
    ...logins.map((login) => collection.doc(login)),
  );
  snapshots.forEach((snapshot, index) => {
    const data = snapshot.data();
    if (snapshot.exists && data) {
      result.set(logins[index], normalizeReviewerCycleAggregate(data));
    }
  });
  return result;
}

/**
 * Writes reviewer aggregate documents in chunks.
 * @param entries Aggregates keyed by reviewer login.
 * @returns A promise that resolves after every chunk is written.
 */
export async function upsertReviewerCycleAggregates(
  entries: Array<{ login: string; aggregate: ReviewerCycleAggregateWrite }>,
): Promise<void> {
  for (
    let start = 0;
    start < entries.length;
    start += FIRESTORE_WRITE_BATCH_SIZE
  ) {
    const batch = collection.firestore.batch();

    for (const entry of entries.slice(
      start,
      start + FIRESTORE_WRITE_BATCH_SIZE,
    )) {
      batch.set(
        collection.doc(entry.login),
        serializeReviewerCycleAggregate(entry.aggregate),
      );
    }

    await batch.commit();
  }
}
