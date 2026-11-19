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
import { assertContributionPlatform } from "@/db/utils/validation.utils";
import type { ReviewerDocument } from "@/lib/domain/reviewer-teams.types";

export type FirestoreReviewer = Omit<ReviewerDocument, "lastUpdated"> & {
  lastUpdated: Timestamp;
};

/**
 * Validates the raw Firestore reviewer document shape.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreReviewer(
  data: FirebaseFirestore.DocumentData,
): asserts data is FirestoreReviewer {
  assertContributionPlatform("platform", data.platform);
  if (!Array.isArray(data.teams)) {
    throw new DbValidationError("teams", "teams must be an array of strings.");
  }
  for (const t of data.teams) {
    if (typeof t !== "string") {
      throw new DbValidationError("teams", "Each team must be a string.");
    }
  }
  if (!Array.isArray(data.pendingReviews)) {
    throw new DbValidationError(
      "pendingReviews",
      "pendingReviews must be an array.",
    );
  }
  for (const review of data.pendingReviews) {
    if (!review || typeof review !== "object" || Array.isArray(review)) {
      throw new DbValidationError(
        "pendingReviews",
        "Each pending review must be an object.",
      );
    }

    const pendingReview = review as Record<
      string,
      FirebaseFirestore.DocumentData[string]
    >;

    if (typeof pendingReview.prNumber !== "number") {
      throw new DbValidationError(
        "pendingReviews.prNumber",
        "Each pending review prNumber must be a number.",
      );
    }
    if (typeof pendingReview.title !== "string") {
      throw new DbValidationError(
        "pendingReviews.title",
        "Each pending review title must be a string.",
      );
    }
    if (typeof pendingReview.url !== "string") {
      throw new DbValidationError(
        "pendingReviews.url",
        "Each pending review url must be a string.",
      );
    }
    if (typeof pendingReview.assignedAt !== "string") {
      throw new DbValidationError(
        "pendingReviews.assignedAt",
        "Each pending review assignedAt must be a string.",
      );
    }
  }
  type RawReviewerValue =
    | FirebaseFirestore.DocumentData[string]
    | null
    | undefined;
  const assertFiniteNumberField = (
    field: string,
    value: RawReviewerValue,
  ): void => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new DbValidationError(field, `${field} must be a finite number.`);
    }
  };
  const assertNullableFiniteNumberField = (
    field: string,
    value: RawReviewerValue,
  ): void => {
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new DbValidationError(
        field,
        `${field} must be a finite number or null.`,
      );
    }
  };

  assertFiniteNumberField("completedReviews", data.completedReviews);
  assertFiniteNumberField("reviewedPrCount", data.reviewedPrCount);
  assertFiniteNumberField("approvedPrCount", data.approvedPrCount);
  assertNullableFiniteNumberField(
    "avgReviewTimeHours",
    data.avgReviewTimeHours,
  );
  assertNullableFiniteNumberField(
    "avgReviewRoundsBeforeApproval",
    data.avgReviewRoundsBeforeApproval,
  );
  assertNullableFiniteNumberField(
    "avgCommentsPerReview",
    data.avgCommentsPerReview,
  );
  assertFiniteNumberField(
    "completedReviewSubmissions",
    data.completedReviewSubmissions,
  );
  assertFiniteNumberField("authoredPrCount", data.authoredPrCount);
  assertNullableFiniteNumberField(
    "avgTimeToApprovalHours",
    data.avgTimeToApprovalHours,
  );
  assertNullableFiniteNumberField("avgReviewsPerWeek", data.avgReviewsPerWeek);
  assertTimestamp("Reviewer", "lastUpdated", data.lastUpdated);
}

/**
 * Normalizes a raw Firestore reviewer document into the app model.
 *
 * Legacy documents written before schema versioning are migrated lazily to the
 * current shape before validation.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized reviewer document.
 */
export function normalizeReviewer(
  data: FirebaseFirestore.DocumentData,
): ReviewerDocument {
  const migrated = migrateDocument(SCHEMA_KEYS.REVIEWERS, data);
  assertFirestoreReviewer(migrated);
  return {
    platform: migrated.platform,
    teams: migrated.teams,
    pendingReviews: migrated.pendingReviews,
    completedReviews: migrated.completedReviews,
    reviewedPrCount: migrated.reviewedPrCount,
    completedReviewSubmissions: migrated.completedReviewSubmissions,
    approvedPrCount: migrated.approvedPrCount,
    authoredPrCount: migrated.authoredPrCount,
    avgReviewTimeHours: migrated.avgReviewTimeHours,
    avgTimeToApprovalHours: migrated.avgTimeToApprovalHours,
    avgReviewRoundsBeforeApproval: migrated.avgReviewRoundsBeforeApproval,
    avgCommentsPerReview: migrated.avgCommentsPerReview,
    avgReviewsPerWeek: migrated.avgReviewsPerWeek,
    lastUpdated: normalizeTimestamp(migrated.lastUpdated),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Serializes a reviewer document for Firestore storage.
 *
 * @param doc The reviewer document to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewer(
  doc: Omit<ReviewerDocument, "schemaVersion">,
): FirestoreReviewer {
  return {
    platform: doc.platform,
    teams: doc.teams,
    pendingReviews: doc.pendingReviews,
    completedReviews: doc.completedReviews,
    reviewedPrCount: doc.reviewedPrCount,
    completedReviewSubmissions: doc.completedReviewSubmissions,
    approvedPrCount: doc.approvedPrCount,
    authoredPrCount: doc.authoredPrCount,
    avgReviewTimeHours: doc.avgReviewTimeHours,
    avgTimeToApprovalHours: doc.avgTimeToApprovalHours,
    avgReviewRoundsBeforeApproval: doc.avgReviewRoundsBeforeApproval,
    avgCommentsPerReview: doc.avgCommentsPerReview,
    avgReviewsPerWeek: doc.avgReviewsPerWeek,
    lastUpdated: Timestamp.fromDate(doc.lastUpdated),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEWERS),
  };
}
