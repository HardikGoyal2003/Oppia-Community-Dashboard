import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type ReviewerCycleAggregateDocument = {
  completedReviews: number;
  reviewedPrNumbers: number[];
  approvedPrNumbers: number[];
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
 * Validates a finite numeric field.
 * @param field Field name.
 * @param value Raw field value.
 * @returns Nothing.
 */
function assertFiniteNumber(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DbValidationError(field, `${field} must be a finite number.`);
  }
}

/**
 * Validates an array of numeric values.
 * @param field Field name.
 * @param value Raw field value.
 * @returns Nothing.
 */
function assertNumberArray(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): asserts value is number[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "number")
  ) {
    throw new DbValidationError(field, `${field} must be an array of numbers.`);
  }
}

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
    "totalReviewTimeMs",
    "totalRoundsBeforeApproval",
    "totalComments",
    "completedReviewSubmissions",
    "totalApprovalDurationMs",
    "approvalsWithDuration",
  ]) {
    assertFiniteNumber(field, migrated[field]);
  }
  assertNumberArray("reviewedPrNumbers", migrated.reviewedPrNumbers);
  assertNumberArray("approvedPrNumbers", migrated.approvedPrNumbers);
  assertStringArray("activeWeeks", migrated.activeWeeks);
  assertTimestamp(
    "ReviewerCycleAggregate",
    "lastUpdated",
    migrated.lastUpdated,
  );
  assertSchemaVersion(
    SCHEMA_KEYS.REVIEWER_CYCLE_AGGREGATES,
    migrated.schemaVersion,
  );
  return {
    completedReviews: migrated.completedReviews,
    reviewedPrNumbers: migrated.reviewedPrNumbers,
    approvedPrNumbers: migrated.approvedPrNumbers,
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
