import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ReviewCycleRecord } from "@/lib/domain/reviewer-teams.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreReviewCycle,
  serializeReviewCycle,
} from "./review-cycles.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEW_CYCLES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewCycle>;

/**
 * Upserts a single review cycle record into Firestore.
 *
 * Uses `${reviewerLogin}:${prNumber}:${assignedAt}` as the doc ID
 * so re-syncing the same cycle is idempotent.
 *
 * @param record The cycle record to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function upsertReviewCycle(
  record: ReviewCycleRecord,
): Promise<void> {
  const key = `${record.reviewerLogin}:${record.prNumber}:${record.assignedAt}`;
  await collection.doc(key).set(serializeReviewCycle(record), { merge: true });
}

/**
 * Batch upserts multiple review cycle records.
 *
 * @param records The cycle records to persist.
 * @returns A promise that resolves when the batch write completes.
 */
export async function upsertReviewCycles(
  records: ReviewCycleRecord[],
): Promise<void> {
  const batch = db.batch();
  for (const record of records) {
    const key = `${record.reviewerLogin}:${record.prNumber}:${record.assignedAt}`;
    batch.set(collection.doc(key), serializeReviewCycle(record), {
      merge: true,
    });
  }
  await batch.commit();
}

/**
 * Given a list of candidate cycle records, returns only those whose
 * corresponding Firestore doc does not yet exist.
 *
 * Uses composite key `${reviewerLogin}:${prNumber}:${assignedAt}`.
 *
 * @param records The candidate cycle records.
 * @returns The subset of records that are new (not yet in Firestore).
 */
export async function findNewCycleRecords(
  records: ReviewCycleRecord[],
): Promise<ReviewCycleRecord[]> {
  if (records.length === 0) return [];

  const firestore = getAdminFirestore();
  const refs = records.map((r) =>
    collection.doc(`${r.reviewerLogin}:${r.prNumber}:${r.assignedAt}`),
  );

  const snapshots = await firestore.getAll(...refs);

  return records.filter((_, i) => !snapshots[i].exists);
}

/**
 * Computes aggregate stats for a given reviewer from their stored cycles.
 *
 * @param login The GitHub login of the reviewer.
 * @returns The aggregate reviews done count and total review time in ms.
 */
export async function getReviewCycleAggregates(
  login: string,
): Promise<{ reviewsDone: number; totalReviewTimeMs: number }> {
  const snapshot = await collection.where("reviewerLogin", "==", login).get();

  let reviewsDone = 0;
  let totalReviewTimeMs = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    reviewsDone++;
    totalReviewTimeMs += data.durationMs;
  });

  return { reviewsDone, totalReviewTimeMs };
}

/**
 * Computes aggregate stats for all reviewers from all stored cycles.
 *
 * @returns A map of login to aggregate stats.
 */
export async function getAllReviewCycleAggregates(): Promise<
  Map<string, { reviewsDone: number; totalReviewTimeMs: number }>
> {
  const snapshot = await collection.get();
  const map = new Map<
    string,
    { reviewsDone: number; totalReviewTimeMs: number }
  >();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const login = data.reviewerLogin;
    const existing = map.get(login) ?? { reviewsDone: 0, totalReviewTimeMs: 0 };
    existing.reviewsDone++;
    existing.totalReviewTimeMs += data.durationMs;
    map.set(login, existing);
  });

  return map;
}
