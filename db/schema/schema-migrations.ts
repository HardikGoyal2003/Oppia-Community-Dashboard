import { DbValidationError } from "@/db/db.errors";
import {
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
type SchemaMigration = {
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
 * Determines whether a value is a valid GFI count.
 *
 * @param value The raw value to inspect.
 * @returns True when the value is a finite, non-negative integer.
 */
function isValidGfiCount(
  value: FirebaseFirestore.DocumentData[string],
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isInteger(value)
  );
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
      const legacyFields = [
        "backend",
        "frontend",
        "fullstack",
        "uncategorized",
      ] as const;

      if (
        document.gfiCount !== undefined &&
        !isValidGfiCount(document.gfiCount)
      ) {
        throw new DbValidationError(
          "gfiCount",
          "gfiCount must be a finite non-negative integer.",
        );
      }

      const hasExistingGfiCount = isValidGfiCount(document.gfiCount);
      const rawCounts = document.gfiCounts;
      let gfiCount = hasExistingGfiCount ? document.gfiCount : 0;

      if (rawCounts !== undefined) {
        if (
          rawCounts === null ||
          typeof rawCounts !== "object" ||
          Array.isArray(rawCounts)
        ) {
          throw new DbValidationError(
            "gfiCounts",
            "Legacy gfiCounts must be an object when present.",
          );
        }

        const counts = rawCounts as Record<
          string,
          FirebaseFirestore.DocumentData[string]
        >;
        let hasLegacyCount = false;
        let derivedTotal = 0;

        for (const field of legacyFields) {
          if (!(field in counts)) {
            continue;
          }

          const value = counts[field];
          if (!isValidGfiCount(value)) {
            throw new DbValidationError(
              `gfiCounts.${field}`,
              "Legacy GFI counts must be finite non-negative integers.",
            );
          }

          hasLegacyCount = true;
          derivedTotal += value;
        }

        if (!hasExistingGfiCount && hasLegacyCount) {
          gfiCount = derivedTotal;
        }
      }

      const migratedDocument: FirebaseFirestore.DocumentData = {
        ...document,
        gfiCount,
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
const SCHEMA_MIGRATIONS: Record<SchemaKey, readonly SchemaMigration[]> = {
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
  [SCHEMA_KEYS.REVIEWER_CYCLE_AGGREGATES]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.REVIEW_CYCLE_PR_STATS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.REVIEW_CYCLE_MONTHLY_REVIEWERS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.REVIEW_CYCLE_BACKFILL]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.TEAM_REVIEWERS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.TEAMS]: [addSchemaVersionField(1), collapseTeamGfiCounts()],
  [SCHEMA_KEYS.UNREGISTERED_MEMBERS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.USER_JOURNEY_PROGRESS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.USER_NOTIFICATIONS]: [addSchemaVersionField(1)],
  [SCHEMA_KEYS.USERS]: [addSchemaVersionField(1)],
};

/**
 * Validates that the migration registry is contiguous and consistent with the
 * supported schema versions.
 *
 * @returns Nothing. Throws when the registry is misconfigured.
 */
function assertMigrationRegistryInvariants(): void {
  for (const key of Object.keys(SCHEMA_MIGRATIONS) as SchemaKey[]) {
    const migrations = SCHEMA_MIGRATIONS[key];
    const currentVersion = getCurrentSchemaVersion(key);
    const seenVersions = new Set<number>();

    for (const [index, migration] of migrations.entries()) {
      if (!Number.isInteger(migration.toVersion) || migration.toVersion <= 0) {
        throw new DbValidationError(
          "schemaVersion",
          `Migration for ${key} must target a positive integer schema version.`,
        );
      }

      if (seenVersions.has(migration.toVersion)) {
        throw new DbValidationError(
          "schemaVersion",
          `Duplicate migration for ${key} schema version ${migration.toVersion}.`,
        );
      }
      seenVersions.add(migration.toVersion);

      const expectedVersion = index + 1;
      if (migration.toVersion !== expectedVersion) {
        throw new DbValidationError(
          "schemaVersion",
          `Migrations for ${key} must be contiguous from version 1; expected ${expectedVersion} but found ${migration.toVersion}.`,
        );
      }
    }

    if (migrations.length !== currentVersion) {
      throw new DbValidationError(
        "schemaVersion",
        `Migrations for ${key} must cover versions 1 through ${currentVersion}.`,
      );
    }
  }
}

assertMigrationRegistryInvariants();

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
