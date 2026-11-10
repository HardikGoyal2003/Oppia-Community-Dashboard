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
import type { ReviewCycleBackfillState } from "@/lib/domain/review-cycle-backfill.types";

export type FirestoreReviewCycleBackfillState = {
  windowStart: string;
  windowEnd: string;
  targetEnd: string;
  processedPrNumbers: number[];
  updatedAt: Timestamp;
  schemaVersion: number;
};

/**
 * Asserts that a raw value is a `YYYY-MM-DD` date key.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is not a date key.
 */
function assertDateKey(
  field: string,
  value: string | undefined,
): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DbValidationError(
      field,
      `${field} must be a YYYY-MM-DD date key.`,
    );
  }
}

/**
 * Validates a raw Firestore review-cycle backfill state document.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreReviewCycleBackfillState(
  data: FirebaseFirestore.DocumentData,
): asserts data is FirestoreReviewCycleBackfillState {
  assertDateKey("windowStart", data.windowStart);
  assertDateKey("windowEnd", data.windowEnd);
  assertDateKey("targetEnd", data.targetEnd);

  if (
    !Array.isArray(data.processedPrNumbers) ||
    data.processedPrNumbers.some((value) => typeof value !== "number")
  ) {
    throw new DbValidationError(
      "processedPrNumbers",
      "processedPrNumbers must be an array of numbers.",
    );
  }

  assertTimestamp("ReviewCycleBackfill", "updatedAt", data.updatedAt);
  assertSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_BACKFILL, data.schemaVersion);
}

/**
 * Normalizes a raw Firestore review-cycle backfill state document.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized backfill state.
 */
export function normalizeReviewCycleBackfillState(
  data: FirebaseFirestore.DocumentData,
): ReviewCycleBackfillState {
  const migrated = migrateDocument(SCHEMA_KEYS.REVIEW_CYCLE_BACKFILL, data);
  assertFirestoreReviewCycleBackfillState(migrated);
  return {
    windowStart: migrated.windowStart,
    windowEnd: migrated.windowEnd,
    targetEnd: migrated.targetEnd,
    processedPrNumbers: migrated.processedPrNumbers,
    updatedAt: normalizeTimestamp(migrated.updatedAt),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Serializes review-cycle backfill state for Firestore storage.
 *
 * @param state The backfill state to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCycleBackfillState(
  state: Omit<ReviewCycleBackfillState, "schemaVersion">,
): FirestoreReviewCycleBackfillState {
  return {
    windowStart: state.windowStart,
    windowEnd: state.windowEnd,
    targetEnd: state.targetEnd,
    processedPrNumbers: state.processedPrNumbers,
    updatedAt: Timestamp.fromDate(state.updatedAt),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_BACKFILL),
  };
}
