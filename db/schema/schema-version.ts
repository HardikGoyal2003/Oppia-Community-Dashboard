import { DbValidationError } from "@/db/db.errors";

/**
 * Version assigned to documents that were written before schema versioning
 * existed. Legacy documents omit the `schemaVersion` field entirely.
 */
export const LEGACY_SCHEMA_VERSION = 0;

/**
 * Stable keys for every persisted model that participates in schema
 * versioning. A key is not the collection name; it identifies a model shape
 * so migrations stay attached to the correct model if a collection is renamed.
 */
export const SCHEMA_KEYS = {
  ACTION_ITEMS: "actionItems",
  ARCHIVED_DISCUSSIONS: "archivedDiscussions",
  ARCHIVED_ISSUES: "archivedIssues",
  DAILY_TEAM_METRICS: "dailyTeamMetrics",
  DAILY_DISCUSSION_METRICS: "dailyDiscussionMetrics",
  DATA_JOB_RUNS: "dataJobRuns",
  MEMBER_ACCESS_REQUESTS: "memberAccessRequests",
  NOTIFICATION_DELIVERIES: "notificationDeliveries",
  ORG_META: "orgMeta",
  REVIEWERS: "reviewers",
  REVIEW_CYCLES: "reviewCycles",
  REVIEW_CYCLE_ANALYTICS: "reviewCycleAnalytics",
  REVIEW_CYCLE_BACKFILL: "reviewCycleBackfill",
  TEAM_REVIEWERS: "teamReviewers",
  TEAMS: "teams",
  USER_JOURNEY_PROGRESS: "userJourneyProgress",
  USER_NOTIFICATIONS: "userNotifications",
  USERS: "users",
} as const;

export type SchemaKey = (typeof SCHEMA_KEYS)[keyof typeof SCHEMA_KEYS];

/**
 * Latest schema version supported by the application for each model.
 *
 * To evolve a model:
 *   1. Bump the version here.
 *   2. Add a migration with the matching `toVersion` in `schema-migrations.ts`.
 *   3. Update the Firestore type, mapper, and any related domain types.
 *   4. Update `db/db-schema.md` and `db/schema-versioning.md`.
 *
 * Never reuse or renumber a published version.
 */
export const SCHEMA_VERSIONS: Record<SchemaKey, number> = {
  [SCHEMA_KEYS.ACTION_ITEMS]: 1,
  [SCHEMA_KEYS.ARCHIVED_DISCUSSIONS]: 1,
  [SCHEMA_KEYS.ARCHIVED_ISSUES]: 1,
  [SCHEMA_KEYS.DAILY_TEAM_METRICS]: 1,
  [SCHEMA_KEYS.DAILY_DISCUSSION_METRICS]: 1,
  [SCHEMA_KEYS.DATA_JOB_RUNS]: 1,
  [SCHEMA_KEYS.MEMBER_ACCESS_REQUESTS]: 1,
  [SCHEMA_KEYS.NOTIFICATION_DELIVERIES]: 1,
  [SCHEMA_KEYS.ORG_META]: 1,
  [SCHEMA_KEYS.REVIEWERS]: 1,
  [SCHEMA_KEYS.REVIEW_CYCLES]: 1,
  [SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS]: 1,
  [SCHEMA_KEYS.REVIEW_CYCLE_BACKFILL]: 1,
  [SCHEMA_KEYS.TEAM_REVIEWERS]: 1,
  [SCHEMA_KEYS.TEAMS]: 2,
  [SCHEMA_KEYS.USER_JOURNEY_PROGRESS]: 1,
  [SCHEMA_KEYS.USER_NOTIFICATIONS]: 1,
  [SCHEMA_KEYS.USERS]: 1,
};

/**
 * Returns the latest schema version supported for a model.
 *
 * @param key The stable schema key of the model.
 * @returns The current schema version.
 */
export function getCurrentSchemaVersion(key: SchemaKey): number {
  return SCHEMA_VERSIONS[key];
}

/**
 * Validates that a stored schema version is a positive integer.
 *
 * @param key The stable schema key of the model.
 * @param value The raw `schemaVersion` value read from Firestore.
 * @returns Nothing. Throws when the value is not a valid schema version.
 */
export function assertSchemaVersion(
  key: SchemaKey,
  value: number | string | boolean | object | null | undefined,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new DbValidationError(
      "schemaVersion",
      `${key} schemaVersion must be a positive integer.`,
    );
  }
}

/**
 * Reads the schema version stored on a Firestore document. Missing values are
 * treated as the legacy pre-versioning shape so old documents remain readable.
 *
 * @param key The stable schema key of the model.
 * @param document The raw Firestore document data.
 * @returns The document schema version, or `LEGACY_SCHEMA_VERSION` when absent.
 */
export function readSchemaVersion(
  key: SchemaKey,
  document: FirebaseFirestore.DocumentData,
): number {
  const rawVersion = document.schemaVersion;

  if (rawVersion === undefined || rawVersion === null) {
    return LEGACY_SCHEMA_VERSION;
  }

  assertSchemaVersion(key, rawVersion);

  return rawVersion;
}
