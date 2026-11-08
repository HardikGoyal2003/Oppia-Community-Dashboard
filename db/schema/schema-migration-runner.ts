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

/** Summary of a schema-version backfill pass. */
export type SchemaVersionBackfillSummary = {
  scannedCount: number;
  migratedCount: number;
  failedCount: number;
};

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
 * @returns The number of scanned, migrated, and failed documents.
 */
export async function backfillSchemaVersions(options: {
  dryRun: boolean;
}): Promise<SchemaVersionBackfillSummary> {
  const summary: SchemaVersionBackfillSummary = {
    scannedCount: 0,
    migratedCount: 0,
    failedCount: 0,
  };

  for (const target of buildSchemaCollectionTargets()) {
    const snapshot = await target.query.get();

    for (const doc of snapshot.docs) {
      summary.scannedCount += 1;

      try {
        const data = doc.data();

        if (isDocumentAtCurrentSchemaVersion(target.key, data)) {
          continue;
        }

        const migratedDocument = migrateDocument(target.key, data);

        if (!options.dryRun) {
          // Use `set` instead of `update` so fields removed by a migration are
          // actually deleted from the stored document.
          await doc.ref.set(migratedDocument);
        }

        summary.migratedCount += 1;
      } catch (error) {
        summary.failedCount += 1;
        console.error(
          `Failed to backfill schema version for ${target.label}/${doc.id}.`,
          error,
        );
      }
    }
  }

  return summary;
}
