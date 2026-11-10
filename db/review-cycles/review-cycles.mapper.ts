import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";
import type { ReviewCycleRecord } from "@/lib/domain/reviewer-teams.types";

export type FirestoreReviewCycle = ReviewCycleRecord;

/**
 * Asserts that a value is a non-empty string field.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertStringField(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): asserts value is string {
  if (typeof value !== "string") {
    throw new DbValidationError(field, `${field} must be a string.`);
  }
}

/**
 * Asserts that a value is a finite number.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertNumberField(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DbValidationError(field, `${field} must be a number.`);
  }
}

/**
 * Asserts that an optional value is a number or null.
 *
 * Missing values are tolerated for documents written before the field
 * existed and are normalized to null.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertOptionalNumberField(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): void {
  if (value === undefined || value === null) return;
  assertNumberField(field, value);
}

/**
 * Asserts that an optional value is a string or null.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertOptionalStringField(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): void {
  if (value === undefined || value === null) return;
  assertStringField(field, value);
}

/**
 * Validates the required fields of a raw Firestore review-cycle document.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreReviewCycle(
  data: FirebaseFirestore.DocumentData,
): void {
  assertStringField("reviewerLogin", data.reviewerLogin);
  assertNumberField("prNumber", data.prNumber);
  assertStringField("prTitle", data.prTitle);
  assertStringField("prUrl", data.prUrl);
  assertStringField("assignedAt", data.assignedAt);
  assertStringField("completedAt", data.completedAt);
  assertNumberField("durationMs", data.durationMs);

  assertOptionalNumberField(
    "reviewRoundsBeforeApproval",
    data.reviewRoundsBeforeApproval,
  );
  assertOptionalNumberField("commentCount", data.commentCount);
  assertOptionalNumberField(
    "reviewSubmissionCount",
    data.reviewSubmissionCount,
  );
  assertOptionalStringField("approvedAt", data.approvedAt);
  assertOptionalNumberField("approvalDurationMs", data.approvalDurationMs);
  assertOptionalNumberField("prAdditions", data.prAdditions);

  assertSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLES, data.schemaVersion);
}

/**
 * Converts an optional numeric field to a number or null.
 *
 * @param value The raw value.
 * @returns The numeric value, or null when absent.
 */
function numberOrNull(
  value: FirebaseFirestore.DocumentData[string],
): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * Converts an optional numeric counter to a number, defaulting to zero.
 *
 * @param value The raw value.
 * @returns The numeric value, or zero when absent.
 */
function numberOrZero(value: FirebaseFirestore.DocumentData[string]): number {
  return typeof value === "number" ? value : 0;
}

/**
 * Converts an optional string field to a string or null.
 *
 * @param value The raw value.
 * @returns The string value, or null when absent.
 */
function stringOrNull(
  value: FirebaseFirestore.DocumentData[string],
): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Normalizes a raw Firestore review-cycle document.
 *
 * Legacy documents written before schema versioning are migrated lazily to the
 * current shape before validation.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized review-cycle record.
 */
export function normalizeReviewCycle(
  data: FirebaseFirestore.DocumentData,
): ReviewCycleRecord {
  const migrated = migrateDocument(SCHEMA_KEYS.REVIEW_CYCLES, data);
  assertFirestoreReviewCycle(migrated);

  return {
    reviewerLogin: migrated.reviewerLogin,
    prNumber: migrated.prNumber,
    prTitle: migrated.prTitle,
    prUrl: migrated.prUrl,
    assignedAt: migrated.assignedAt,
    completedAt: migrated.completedAt,
    durationMs: migrated.durationMs,
    reviewRoundsBeforeApproval: numberOrNull(
      migrated.reviewRoundsBeforeApproval,
    ),
    commentCount: numberOrZero(migrated.commentCount),
    reviewSubmissionCount: numberOrZero(migrated.reviewSubmissionCount),
    approvedAt: stringOrNull(migrated.approvedAt),
    approvalDurationMs: numberOrNull(migrated.approvalDurationMs),
    prAdditions: numberOrNull(migrated.prAdditions),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Serializes a review cycle record for Firestore storage.
 *
 * @param record The review cycle record to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCycle(
  record: Omit<ReviewCycleRecord, "schemaVersion">,
): FirestoreReviewCycle {
  return {
    ...record,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLES),
  };
}
