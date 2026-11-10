import { DbValidationError } from "@/db/db.errors";
import {
  LEGACY_SCHEMA_VERSION,
  SCHEMA_KEYS,
  SCHEMA_VERSIONS,
  getCurrentSchemaVersion,
  readSchemaVersion,
  type SchemaKey,
} from "@/db/schema/schema-version";

/**
 * A single forward migration for a persisted model.
 *
 * Migrations must be pure and idempotent: they receive the stored document and
 * return the document shape for `toVersion`. They run in order, one version at
 * a time, so a document can be upgraded across multiple versions in one pass.
 */
export type SchemaMigration = {
  /** Version produced by this migration. Must be exactly the previous version + 1. */
  toVersion: number;
  migrate: (
    document: FirebaseFirestore.DocumentData,
  ) => FirebaseFirestore.DocumentData;
};

/**
 * Builds the shared migration that introduces the `schemaVersion` field.
 *
 * @param version The schema version being introduced.
 * @returns The migration that stamps the version onto an unversioned document.
 */
function addSchemaVersionField(version: number): SchemaMigration {
  return {
    toVersion: version,
    migrate: (document) => ({
      ...document,
      schemaVersion: version,
    }),
  };
}

/**
 * Builds the migration that collapses the per-domain GFI count object into a
 * single total GFI count.
 *
 * @returns The migration from team schema version 1 to version 2.
 */
function collapseTeamGfiCounts(): SchemaMigration {
  return {
    toVersion: 2,
    migrate: (document) => {
      const rawCounts = document.gfiCounts;
      const counts =
        rawCounts !== null && typeof rawCounts === "object"
          ? (rawCounts as Record<string, number | undefined>)
          : null;
      const totalFromCounts = [
        "backend",
        "frontend",
        "fullstack",
        "uncategorized",
      ].reduce((sum, field) => {
        const value = counts?.[field];

        return (
          sum +
          (typeof value === "number" && Number.isFinite(value) ? value : 0)
        );
      }, 0);
      const existingTotal =
        typeof document.gfiCount === "number" &&
        Number.isFinite(document.gfiCount)
          ? document.gfiCount
          : 0;
      const migratedDocument: FirebaseFirestore.DocumentData = {
        ...document,
        gfiCount: counts ? totalFromCounts : existingTotal,
        schemaVersion: 2,
      };

      delete migratedDocument.gfiCounts;

      return migratedDocument;
    },
  };
}

/**
 * Ordered migrations for every versioned model.
 *
 * Version 1 is the first versioned shape: it adds `schemaVersion` to documents
 * that predate versioning. Future structural changes get a new entry with the
 * next `toVersion` here (and a matching bump in `SCHEMA_VERSIONS`).
 */
export const SCHEMA_MIGRATIONS: Record<SchemaKey, readonly SchemaMigration[]> =
  {
    [SCHEMA_KEYS.ACTION_ITEMS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.ARCHIVED_DISCUSSIONS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.ARCHIVED_ISSUES]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.DAILY_TEAM_METRICS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.DAILY_DISCUSSION_METRICS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.DATA_JOB_RUNS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.MEMBER_ACCESS_REQUESTS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.NOTIFICATION_DELIVERIES]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.ORG_META]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.REVIEWERS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.REVIEW_CYCLES]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.REVIEW_CYCLE_BACKFILL]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.TEAM_REVIEWERS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.TEAMS]: [addSchemaVersionField(1), collapseTeamGfiCounts()],
    [SCHEMA_KEYS.USER_JOURNEY_PROGRESS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.USER_NOTIFICATIONS]: [addSchemaVersionField(1)],
    [SCHEMA_KEYS.USERS]: [addSchemaVersionField(1)],
  };

/**
 * Upgrades a raw Firestore document from its stored schema version to the
 * latest version supported by the application.
 *
 * Documents without a `schemaVersion` are treated as legacy (version 0) and
 * upgraded to the first versioned shape. Documents written by a newer app
 * version are rejected rather than normalized with an unknown shape.
 *
 * @param key The stable schema key of the model.
 * @param document The raw Firestore document data.
 * @returns The document upgraded to the current schema version.
 * @throws {DbValidationError} When the document version is unsupported or a
 * migration is missing.
 */
export function migrateDocument(
  key: SchemaKey,
  document: FirebaseFirestore.DocumentData,
): FirebaseFirestore.DocumentData {
  const currentVersion = getCurrentSchemaVersion(key);
  const storedVersion = readSchemaVersion(key, document);

  if (storedVersion > currentVersion) {
    throw new DbValidationError(
      "schemaVersion",
      `${key} schemaVersion ${storedVersion} is newer than the supported version ${currentVersion}.`,
    );
  }

  let migratedDocument = document;
  let version = storedVersion;

  while (version < currentVersion) {
    const nextVersion = version + 1;
    const migration = SCHEMA_MIGRATIONS[key].find(
      (candidate) => candidate.toVersion === nextVersion,
    );

    if (!migration) {
      throw new DbValidationError(
        "schemaVersion",
        `Missing migration for ${key} schema version ${nextVersion}.`,
      );
    }

    migratedDocument = migration.migrate(migratedDocument);
    version = nextVersion;
  }

  return {
    ...migratedDocument,
    schemaVersion: version,
  };
}

/**
 * Indicates whether a raw document already matches the latest schema version.
 *
 * @param key The stable schema key of the model.
 * @param document The raw Firestore document data.
 * @returns True when the document is already at the current version.
 */
export function isDocumentAtCurrentSchemaVersion(
  key: SchemaKey,
  document: FirebaseFirestore.DocumentData,
): boolean {
  return readSchemaVersion(key, document) === SCHEMA_VERSIONS[key];
}

/**
 * Returns the latest schema version for a model. Re-exported for convenience
 * so callers only need to import from the migration module.
 */
export { LEGACY_SCHEMA_VERSION, getCurrentSchemaVersion };
