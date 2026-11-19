import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DbValidationError } from "@/db/db.errors";
import { FIRESTORE_WRITE_BATCH_SIZE } from "@/db/utils/batch.utils";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  buildReviewCycleAnalyticsDocId,
  buildReviewCycleDocId,
} from "@/db/reviewer-doc-ids";
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
/**
 * Returns the analytics snapshot document for a platform.
 *
 * @param platform The repository platform the snapshot belongs to.
 * @returns The platform-scoped analytics document reference.
 */
function getAnalyticsDoc(
  platform: ContributionPlatform,
): FirebaseFirestore.DocumentReference<FirestoreReviewCycleAnalytics> {
  return db
    .collection(DB_PATHS.REVIEW_CYCLE_ANALYTICS.COLLECTION)
    .doc(
      buildReviewCycleAnalyticsDocId(platform),
    ) as FirebaseFirestore.DocumentReference<FirestoreReviewCycleAnalytics>;
}

/** Firestore `in` filters accept at most 30 comparison values. */
const AGGREGATE_LOGIN_CHUNK_SIZE = 30;

/**
 * Batch upserts multiple review cycle records.
 *
 * A 2-month backfill can produce well over the Firestore batch limit.
 *
 * @param platform The repository platform the cycles belong to.
 * @param records The cycle records to persist.
 * @returns A promise that resolves when all batch writes complete.
 */
export async function upsertReviewCycles(
  platform: ContributionPlatform,
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
      const key = buildReviewCycleDocId(
        platform,
        record.reviewerLogin,
        record.prNumber,
        record.assignedAt,
      );
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
 * @param platform The repository platform the cycles belong to.
 * @param logins The reviewer logins whose cycles should be deleted.
 * @returns The number of deleted documents.
 */
export async function deleteReviewCyclesForReviewers(
  platform: ContributionPlatform,
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
    const snapshot = await collection
      .where("platform", "==", platform)
      .where("reviewerLogin", "in", chunk)
      .get();

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
 * Builds the Firestore document id for a review cycle record.
 *
 * @param platform The repository platform the cycle belongs to.
 * @param record The review cycle record.
 * @returns The composite review cycle document id.
 */
function getReviewCycleDocumentId(
  platform: ContributionPlatform,
  record: Omit<ReviewCycleRecord, "schemaVersion">,
): string {
  return buildReviewCycleDocId(
    platform,
    record.reviewerLogin,
    record.prNumber,
    record.assignedAt,
  );
}

/**
 * Determines whether a Firestore create failure means the document already exists.
 *
 * @param error The thrown error candidate.
 * @returns True when the error indicates an existing document.
 */
function isDocumentAlreadyExistsError(
  error: object | string | number | boolean | null | undefined,
): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 6
  );
}

/**
 * Claims review cycle records by creating their documents.
 *
 * Only records whose documents did not already exist are returned, so callers
 * can safely apply contributions exactly once per claimed cycle. Concurrent
 * claims for the same cycle will not both succeed.
 *
 * @param platform The repository platform the cycles belong to.
 * @param records The candidate cycle records to claim.
 * @returns The subset of records that were actually created.
 */
export async function createNewReviewCycles(
  platform: ContributionPlatform,
  records: Array<Omit<ReviewCycleRecord, "schemaVersion">>,
): Promise<Array<Omit<ReviewCycleRecord, "schemaVersion">>> {
  if (records.length === 0) return [];

  const uniqueRecords = Array.from(
    new Map(
      records.map((record) => [
        getReviewCycleDocumentId(platform, record),
        record,
      ]),
    ).values(),
  );
  const createdRecords: Array<Omit<ReviewCycleRecord, "schemaVersion">> = [];
  const claimChunkSize = 50;

  for (let start = 0; start < uniqueRecords.length; start += claimChunkSize) {
    const chunk = uniqueRecords.slice(start, start + claimChunkSize);
    const results = await Promise.all(
      chunk.map(async (record) => {
        try {
          await collection
            .doc(getReviewCycleDocumentId(platform, record))
            .create(serializeReviewCycle(record));
          return record;
        } catch (error) {
          if (
            isDocumentAlreadyExistsError(
              error as object | string | number | boolean | null | undefined,
            )
          ) {
            return null;
          }

          throw error;
        }
      }),
    );

    for (const record of results) {
      if (record) {
        createdRecords.push(record);
      }
    }
  }

  return createdRecords;
}

/**
 * Reads the precomputed reviewer analytics snapshot.
 *
 * The dashboard reads this single document instead of scanning the whole
 * review-cycles collection on every page load. The snapshot is refreshed by
 * the cycle sync and the backfill job.
 *
 * @param platform The repository platform the snapshot belongs to.
 * @returns The stored analytics, or null when no snapshot exists.
 */
export async function getReviewCycleAnalyticsSnapshot(
  platform: ContributionPlatform,
): Promise<ReviewerTeamsAnalytics | null> {
  const snapshot = await getAnalyticsDoc(platform).get();
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
 * @param platform The repository platform the snapshot belongs to.
 * @param analytics The analytics payload to persist.
 * @returns A promise that resolves when the snapshot is written.
 */
export async function saveReviewCycleAnalyticsSnapshot(
  platform: ContributionPlatform,
  analytics: Omit<ReviewerTeamsAnalytics, "schemaVersion">,
): Promise<void> {
  await getAnalyticsDoc(platform).set(serializeReviewCycleAnalytics(analytics));
}

/**
 * Retrieves all review cycles, normalized.
 *
 * @param platform The repository platform the cycles belong to.
 * @returns All normalized review cycle records for the platform.
 */
export async function getAllReviewCycles(
  platform: ContributionPlatform,
): Promise<ReviewCycleRecord[]> {
  const snapshot = await collection.where("platform", "==", platform).get();
  return snapshot.docs.map((doc) => normalizeReviewCycle(doc.data()));
}

/**
 * Retrieves normalized review cycles for the given reviewer logins.
 *
 * @param platform The repository platform the cycles belong to.
 * @param logins The reviewer logins to fetch.
 * @returns The matching normalized review cycle records.
 */
export async function getReviewCyclesByReviewerLogins(
  platform: ContributionPlatform,
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
    const snapshot = await collection
      .where("platform", "==", platform)
      .where("reviewerLogin", "in", chunk)
      .get();
    snapshot.forEach((doc) => records.push(normalizeReviewCycle(doc.data())));
  }

  return records;
}
