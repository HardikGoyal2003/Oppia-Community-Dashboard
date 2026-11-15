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

/**
 * Reviewer logins that submitted a review in a given month.
 *
 * One document per month keeps the monthly membership bounded by the size of
 * the reviewer team instead of growing inside the analytics snapshot.
 */
export type ReviewCycleMonthlyReviewersDocument = {
  month: string;
  logins: string[];
  lastUpdated: Date;
  schemaVersion: number;
};

export type FirestoreReviewCycleMonthlyReviewers = Omit<
  ReviewCycleMonthlyReviewersDocument,
  "lastUpdated"
> & { lastUpdated: Timestamp };

/**
 * Asserts that a raw value is a `YYYY-MM` month key.
 *
 * @param month The raw month value.
 * @returns Nothing. Throws when the value is not a month key.
 */
function assertMonthKey(month: FirebaseFirestore.DocumentData[string]): void {
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    throw new DbValidationError("month", "month must be a YYYY-MM key.");
  }
}

/**
 * Normalizes a raw monthly reviewers document.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized document.
 */
export function normalizeReviewCycleMonthlyReviewers(
  data: FirebaseFirestore.DocumentData,
): ReviewCycleMonthlyReviewersDocument {
  const migrated = migrateDocument(
    SCHEMA_KEYS.REVIEW_CYCLE_MONTHLY_REVIEWERS,
    data,
  );
  assertMonthKey(migrated.month);
  if (
    !Array.isArray(migrated.logins) ||
    migrated.logins.some((login) => typeof login !== "string")
  ) {
    throw new DbValidationError(
      "logins",
      "logins must be an array of reviewer logins.",
    );
  }
  assertTimestamp(
    "ReviewCycleMonthlyReviewers",
    "lastUpdated",
    migrated.lastUpdated,
  );
  assertSchemaVersion(
    SCHEMA_KEYS.REVIEW_CYCLE_MONTHLY_REVIEWERS,
    migrated.schemaVersion,
  );
  return {
    month: migrated.month,
    logins: migrated.logins,
    lastUpdated: normalizeTimestamp(migrated.lastUpdated),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Serializes monthly reviewers for Firestore storage.
 *
 * @param document The document to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCycleMonthlyReviewers(
  document: Omit<ReviewCycleMonthlyReviewersDocument, "schemaVersion">,
): FirestoreReviewCycleMonthlyReviewers {
  return {
    ...document,
    lastUpdated: Timestamp.fromDate(document.lastUpdated),
    schemaVersion: getCurrentSchemaVersion(
      SCHEMA_KEYS.REVIEW_CYCLE_MONTHLY_REVIEWERS,
    ),
  };
}
