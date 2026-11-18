import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DbValidationError } from "@/db/db.errors";
import {
  FIRESTORE_READ_CHUNK_SIZE,
  FIRESTORE_WRITE_BATCH_SIZE,
} from "@/db/utils/batch.utils";
import { DB_PATHS } from "@/db/db-paths";
import type {
  ReviewerTeamsAnalytics,
  ReviewCycleRecord,
} from "@/lib/domain/reviewer-teams.types";
import {
  type FirestoreReviewCycle,
  normalizeReviewCycle,
  serializeReviewCycle,
} from "./review-cycles.mapper";
import {
  type FirestoreReviewCycleAnalytics,
  normalizeReviewCycleAnalytics,
  serializeReviewCycleAnalytics,
} from "./review-cycle-analytics.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.REVIEW_CYCLES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewCycle>;
const analyticsDoc = db
  .collection(DB_PATHS.REVIEW_CYCLE_ANALYTICS.COLLECTION)
  .doc(
    DB_PATHS.REVIEW_CYCLE_ANALYTICS.SNAPSHOT_DOC,
  ) as FirebaseFirestore.DocumentReference<FirestoreReviewCycleAnalytics>;

/** Firestore `in` filters accept at most 30 comparison values. */
const AGGREGATE_LOGIN_CHUNK_SIZE = 30;

/**
 * Batch upserts multiple review cycle records.
 *
 * A 2-month backfill can produce well over the Firestore batch limit.
 *
 * @param records The cycle records to persist.
 * @returns A promise that resolves when all batch writes complete.
 */
export async function upsertReviewCycles(
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<void> {
  for (
    let start = 0;
    start < records.length;
    start += FIRESTORE_WRITE_BATCH_SIZE
  ) {
    const batch = collection.firestore.batch();

    for (const record of records.slice(
      start,
      start + FIRESTORE_WRITE_BATCH_SIZE,
    )) {
      const key = `${record.reviewerLogin}:${record.prNumber}:${record.assignedAt}`;
      batch.set(collection.doc(key), serializeReviewCycle(record), {
        merge: true,
      });
    }

    await batch.commit();
  }
}

/**
 * Deletes every stored review cycle belonging to the given reviewer logins.
 *
 * The dummy-data generator uses this to replace its sample reviewers' cycles,
 * so repeated runs do not accumulate duplicates under new document keys.
 *
 * @param logins The reviewer logins whose cycles should be deleted.
 * @returns The number of deleted documents.
 */
export async function deleteReviewCyclesForReviewers(
  logins: string[],
): Promise<number> {
  const uniqueLogins = Array.from(new Set(logins));
  let deleted = 0;

  for (
    let start = 0;
    start < uniqueLogins.length;
    start += AGGREGATE_LOGIN_CHUNK_SIZE
  ) {
    const chunk = uniqueLogins.slice(start, start + AGGREGATE_LOGIN_CHUNK_SIZE);
    const snapshot = await collection.where("reviewerLogin", "in", chunk).get();

    for (
      let offset = 0;
      offset < snapshot.docs.length;
      offset += FIRESTORE_WRITE_BATCH_SIZE
    ) {
      const batch = collection.firestore.batch();

      for (const doc of snapshot.docs.slice(
        offset,
        offset + FIRESTORE_WRITE_BATCH_SIZE,
      )) {
        batch.delete(doc.ref);
      }

      await batch.commit();
    }

    deleted += snapshot.size;
  }

  return deleted;
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
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<Array<Omit<ReviewCycleRecord, "schemaVersion">>> {
  if (records.length === 0) return [];

  const newRecords: Array<Omit<ReviewCycleRecord, "schemaVersion">> = [];

  for (
    let start = 0;
    start < records.length;
    start += FIRESTORE_READ_CHUNK_SIZE
  ) {
    const chunk = records.slice(start, start + FIRESTORE_READ_CHUNK_SIZE);
    const refs = chunk.map((r) =>
      collection.doc(`${r.reviewerLogin}:${r.prNumber}:${r.assignedAt}`),
    );

    const snapshots = await db.getAll(...refs);

    chunk.forEach((record, i) => {
      if (!snapshots[i].exists) newRecords.push(record);
    });
  }

  return newRecords;
}

/**
 * Reads the precomputed reviewer analytics snapshot.
 *
 * The dashboard reads this single document instead of scanning the whole
 * review-cycles collection on every page load. The snapshot is refreshed by
 * the cycle sync and the backfill job.
 *
 * @returns The stored analytics, or null when no snapshot exists.
 */
export async function getReviewCycleAnalyticsSnapshot(): Promise<ReviewerTeamsAnalytics | null> {
  const snapshot = await analyticsDoc.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;

  try {
    return normalizeReviewCycleAnalytics(data);
  } catch (error) {
    if (error instanceof DbValidationError) return null;
    throw error;
  }
}

/**
 * Saves the reviewer analytics snapshot document.
 *
 * @param analytics The analytics payload to persist.
 * @returns A promise that resolves when the snapshot is written.
 */
export async function saveReviewCycleAnalyticsSnapshot(
  analytics: ReviewerTeamsAnalytics,
): Promise<void> {
  await analyticsDoc.set(serializeReviewCycleAnalytics(analytics));
}

/**
 * Retrieves all review cycles, normalized.
 *
 * @returns All normalized review cycle records.
 */
export async function getAllReviewCycles(): Promise<ReviewCycleRecord[]> {
  const snapshot = await collection.get();
  return snapshot.docs.map((doc) => normalizeReviewCycle(doc.data()));
}

/**
 * Retrieves normalized review cycles for the given reviewer logins.
 *
 * @param logins The reviewer logins to fetch.
 * @returns The matching normalized review cycle records.
 */
export async function getReviewCyclesByReviewerLogins(
  logins: string[],
): Promise<ReviewCycleRecord[]> {
  const uniqueLogins = Array.from(new Set(logins));
  if (uniqueLogins.length === 0) return [];

  const records: ReviewCycleRecord[] = [];

  for (
    let start = 0;
    start < uniqueLogins.length;
    start += AGGREGATE_LOGIN_CHUNK_SIZE
  ) {
    const chunk = uniqueLogins.slice(start, start + AGGREGATE_LOGIN_CHUNK_SIZE);
    const snapshot = await collection.where("reviewerLogin", "in", chunk).get();
    snapshot.forEach((doc) => records.push(normalizeReviewCycle(doc.data())));
  }

  return records;
}
