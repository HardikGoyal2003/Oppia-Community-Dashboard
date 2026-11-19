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
import {
  assertContributionPlatform,
  assertMonthKey,
} from "@/db/utils/validation.utils";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

/**
 * Reviewer logins that submitted a review in a given month.
 *
 * One document per month keeps the monthly membership bounded by the size of
 * the reviewer team instead of growing inside the analytics snapshot.
 */
export type ReviewCycleMonthlyReviewersDocument = {
  /** Repository platform this monthly membership belongs to. */
  platform: ContributionPlatform;
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
  assertContributionPlatform("platform", migrated.platform);
  assertMonthKey("month", migrated.month);
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
  return {
    platform: migrated.platform,
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
