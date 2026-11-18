import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import { assertFiniteNumber } from "@/db/utils/validation.utils";

export type ReviewerCycleAggregateDocument = {
  completedReviews: number;
  reviewedPrCount: number;
  approvedPrCount: number;
  totalReviewTimeMs: number;
  totalRoundsBeforeApproval: number;
  totalComments: number;
  completedReviewSubmissions: number;
  totalApprovalDurationMs: number;
  approvalsWithDuration: number;
  activeWeeks: string[];
  lastUpdated: Date;
  schemaVersion: number;
};

export type FirestoreReviewerCycleAggregate = Omit<
  ReviewerCycleAggregateDocument,
  "lastUpdated"
> & { lastUpdated: Timestamp };

/**
 * Validates an array of string values.
 * @param field Field name.
 * @param value Raw field value.
 * @returns Nothing.
 */
function assertStringArray(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new DbValidationError(field, `${field} must be an array of strings.`);
  }
}

/**
 * Normalizes a persisted reviewer aggregate.
 * @param data Raw Firestore document data.
 * @returns The normalized aggregate.
 */
export function normalizeReviewerCycleAggregate(
  data: FirebaseFirestore.DocumentData,
): ReviewerCycleAggregateDocument {
  const migrated = migrateDocument(SCHEMA_KEYS.REVIEWER_CYCLE_AGGREGATES, data);
  for (const field of [
    "completedReviews",
    "reviewedPrCount",
    "approvedPrCount",
    "totalReviewTimeMs",
    "totalRoundsBeforeApproval",
    "totalComments",
    "completedReviewSubmissions",
    "totalApprovalDurationMs",
    "approvalsWithDuration",
  ]) {
    assertFiniteNumber(field, migrated[field]);
  }
  assertStringArray("activeWeeks", migrated.activeWeeks);
  assertTimestamp(
    "ReviewerCycleAggregate",
    "lastUpdated",
    migrated.lastUpdated,
  );
  return {
    completedReviews: migrated.completedReviews,
    reviewedPrCount: migrated.reviewedPrCount,
    approvedPrCount: migrated.approvedPrCount,
    totalReviewTimeMs: migrated.totalReviewTimeMs,
    totalRoundsBeforeApproval: migrated.totalRoundsBeforeApproval,
    totalComments: migrated.totalComments,
    completedReviewSubmissions: migrated.completedReviewSubmissions,
    totalApprovalDurationMs: migrated.totalApprovalDurationMs,
    approvalsWithDuration: migrated.approvalsWithDuration,
    activeWeeks: migrated.activeWeeks,
    lastUpdated: normalizeTimestamp(migrated.lastUpdated),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Serializes an aggregate for Firestore.
 * @param document Aggregate document.
 * @returns Firestore-compatible aggregate.
 */
export function serializeReviewerCycleAggregate(
  document: Omit<ReviewerCycleAggregateDocument, "schemaVersion">,
): FirestoreReviewerCycleAggregate {
  return {
    ...document,
    schemaVersion: getCurrentSchemaVersion(
      SCHEMA_KEYS.REVIEWER_CYCLE_AGGREGATES,
    ),
    lastUpdated: Timestamp.fromDate(document.lastUpdated),
  };
}
