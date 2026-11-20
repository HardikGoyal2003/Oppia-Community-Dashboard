import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import { buildReviewerCycleAggregateDocId } from "@/db/reviewer-doc-ids";
import { FIRESTORE_WRITE_BATCH_SIZE } from "@/db/utils/batch.utils";
import { normalizeGithubUsername } from "@/lib/utils/username.utils";
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
 * @param platform The repository platform the reviewers belong to.
 * @param logins Reviewer logins to read.
 * @returns Aggregates keyed by login.
 */
export async function getReviewerCycleAggregates(
  platform: ContributionPlatform,
  logins: string[],
): Promise<Map<string, ReviewerCycleAggregateDocument>> {
  const result = new Map<string, ReviewerCycleAggregateDocument>();
  const uniqueLogins = Array.from(new Set(logins.map(normalizeGithubUsername)));
  if (uniqueLogins.length === 0) return result;
  const snapshots = await collection.firestore.getAll(
    ...uniqueLogins.map((login) =>
      collection.doc(buildReviewerCycleAggregateDocId(platform, login)),
    ),
  );
  snapshots.forEach((snapshot, index) => {
    const data = snapshot.data();
    if (snapshot.exists && data) {
      result.set(uniqueLogins[index], normalizeReviewerCycleAggregate(data));
    }
  });
  return result;
}

/**
 * Writes reviewer aggregate documents in chunks.
 * @param platform The repository platform the reviewers belong to.
 * @param entries Aggregates keyed by reviewer login. Logins are normalized
 * before they are used as document ids.
 * @returns A promise that resolves after every chunk is written.
 */
export async function upsertReviewerCycleAggregates(
  platform: ContributionPlatform,
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
        collection.doc(buildReviewerCycleAggregateDocId(platform, entry.login)),
        serializeReviewerCycleAggregate(entry.aggregate),
      );
    }

    await batch.commit();
  }
}
