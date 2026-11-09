import { DB_PATHS } from "@/db/db-paths";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  isDocumentAtCurrentSchemaVersion,
  migrateDocument,
} from "@/db/schema/schema-migrations";
import { SCHEMA_KEYS, type SchemaKey } from "@/db/schema/schema-version";

type SchemaCollectionTarget = {
  key: SchemaKey;
  label: string;
  query: FirebaseFirestore.Query;
};

type MigrationWrite = {
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
};

/** Summary of a schema-version backfill pass. */
export type SchemaVersionBackfillSummary = {
  scannedCount: number;
  migratedCount: number;
  failedCount: number;
};

/**
 * Number of document writes to keep in flight at once. Sequential writes made
 * large backfills exceed the 300s serverless execution limit, so writes are
 * issued concurrently in small groups instead.
 */
const WRITE_CONCURRENCY = 50;

/**
 * Default time budget for a backfill pass. The Vercel function limit is 300s;
 * leaving a buffer lets the job report partial progress instead of being killed
 * mid-write and leaving the run stuck in `RUNNING`.
 */
const DEFAULT_TIME_BUDGET_MS = 240_000;

/**
 * Splits a list into fixed-size chunks.
 *
 * @param values The values to split.
 * @param size The maximum chunk size.
 * @returns The chunked values.
 */
function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

/**
 * Builds the error used when a backfill stops early to stay within the
 * serverless execution limit.
 *
 * @param summary The progress made before stopping.
 * @returns The error describing the partial progress.
 */
function buildTimeBudgetError(summary: SchemaVersionBackfillSummary): Error {
  return new Error(
    `Schema backfill paused after ${summary.scannedCount} document(s) to stay within the serverless execution limit ` +
      `(${summary.migratedCount} migrated, ${summary.failedCount} failed). ` +
      "Re-run the job to continue; documents already at the current schema version are skipped.",
  );
}

/**
 * Builds the list of Firestore collections and collection groups that store
 * versioned models. Subcollections are read through collection groups so a
 * single pass covers every parent document.
 *
 * @returns The schema backfill targets.
 */
function buildSchemaCollectionTargets(): SchemaCollectionTarget[] {
  const db = getAdminFirestore();

  return [
    {
      key: SCHEMA_KEYS.USERS,
      label: DB_PATHS.USERS.COLLECTION,
      query: db.collection(DB_PATHS.USERS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.USER_NOTIFICATIONS,
      label: `${DB_PATHS.USERS.COLLECTION}/*/${DB_PATHS.USERS.NOTIFICATIONS_SUBCOLLECTION}`,
      query: db.collectionGroup(DB_PATHS.USERS.NOTIFICATIONS_SUBCOLLECTION),
    },
    {
      key: SCHEMA_KEYS.ARCHIVED_ISSUES,
      label: DB_PATHS.ARCHIVED_ISSUES.COLLECTION,
      query: db.collection(DB_PATHS.ARCHIVED_ISSUES.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.ARCHIVED_DISCUSSIONS,
      label: DB_PATHS.ARCHIVED_DISCUSSIONS.COLLECTION,
      query: db.collection(DB_PATHS.ARCHIVED_DISCUSSIONS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.MEMBER_ACCESS_REQUESTS,
      label: DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION,
      query: db.collection(DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.TEAMS,
      label: DB_PATHS.TEAMS.COLLECTION,
      query: db.collection(DB_PATHS.TEAMS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.ACTION_ITEMS,
      label: `${DB_PATHS.TEAMS.COLLECTION}/*/${DB_PATHS.ACTION_ITEMS.COLLECTION}`,
      query: db.collectionGroup(DB_PATHS.ACTION_ITEMS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.DAILY_TEAM_METRICS,
      label: DB_PATHS.DAILY_TEAM_METRICS.COLLECTION,
      query: db.collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.NOTIFICATION_DELIVERIES,
      label: DB_PATHS.NOTIFICATION_DELIVERIES.COLLECTION,
      query: db.collection(DB_PATHS.NOTIFICATION_DELIVERIES.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.DATA_JOB_RUNS,
      label: DB_PATHS.DATA_JOB_RUNS.COLLECTION,
      query: db.collection(DB_PATHS.DATA_JOB_RUNS.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.ORG_META,
      label: DB_PATHS.ORG_META.COLLECTION,
      query: db.collection(DB_PATHS.ORG_META.COLLECTION),
    },
    {
      key: SCHEMA_KEYS.USER_JOURNEY_PROGRESS,
      label: DB_PATHS.USER_JOURNEY_PROGRESS.COLLECTION,
      query: db.collection(DB_PATHS.USER_JOURNEY_PROGRESS.COLLECTION),
    },
  ];
}

/**
 * Upgrades every stored document to the latest schema version and persists the
 * migrated document. Documents that are already current are left untouched.
 *
 * This is intended for the manual "Backfill Schema Versions" data job. Normal
 * reads migrate lazily through the mappers; this job makes the backfill
 * explicit and auditable.
 *
 * @param options Backfill options.
 * @param options.dryRun When true, scans and reports without writing.
 * @param options.timeBudgetMs Optional maximum time to spend before pausing.
 * @returns The number of scanned, migrated, and failed documents.
 * @throws {Error} When the time budget is exhausted before every collection is
 * scanned. Re-running the job continues where the previous pass stopped because
 * documents already at the current version are skipped.
 */
export async function backfillSchemaVersions(options: {
  dryRun: boolean;
  timeBudgetMs?: number;
}): Promise<SchemaVersionBackfillSummary> {
  const summary: SchemaVersionBackfillSummary = {
    scannedCount: 0,
    migratedCount: 0,
    failedCount: 0,
  };
  const deadline =
    Date.now() + (options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const pendingWrites: MigrationWrite[] = [];

  /**
   * Commits the writes collected so far. Writes are issued in small concurrent
   * groups so a large backfill does not spend one network round trip per
   * document.
   *
   * @returns A promise that resolves when the pending writes are committed.
   */
  const flushPendingWrites = async (): Promise<void> => {
    const writes = pendingWrites.splice(0, pendingWrites.length);

    for (const chunk of chunkValues(writes, WRITE_CONCURRENCY)) {
      const results = await Promise.allSettled(
        chunk.map((write) => write.ref.set(write.data)),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          summary.migratedCount += 1;
          return;
        }

        summary.failedCount += 1;
        console.error(
          `Failed to persist migrated document ${chunk[index].ref.path}.`,
          result.reason,
        );
      });
    }
  };

  for (const target of buildSchemaCollectionTargets()) {
    if (Date.now() >= deadline) {
      await flushPendingWrites();
      throw buildTimeBudgetError(summary);
    }

    const snapshot = await target.query.get();

    for (const doc of snapshot.docs) {
      if (Date.now() >= deadline) {
        await flushPendingWrites();
        throw buildTimeBudgetError(summary);
      }

      summary.scannedCount += 1;

      try {
        const data = doc.data();

        if (isDocumentAtCurrentSchemaVersion(target.key, data)) {
          continue;
        }

        const migratedDocument = migrateDocument(target.key, data);

        if (options.dryRun) {
          summary.migratedCount += 1;
          continue;
        }

        pendingWrites.push({
          ref: doc.ref,
          data: migratedDocument,
        });

        if (pendingWrites.length >= WRITE_CONCURRENCY) {
          await flushPendingWrites();
        }
      } catch (error) {
        summary.failedCount += 1;
        console.error(
          `Failed to backfill schema version for ${target.label}/${doc.id}.`,
          error,
        );
      }
    }
  }

  await flushPendingWrites();

  return summary;
}
