import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";
import { assertTimestamp } from "@/db/utils/timestamp.utils";
import type { ReviewerTeamsAnalytics } from "@/lib/domain/reviewer-teams.types";

/**
 * Internal merge state used to update analytics without rescanning cycles.
 *
 * This is a persistence detail: it must never be returned to clients, so keep
 * it on the stored type only and strip it with `toReviewerTeamsAnalytics`.
 */
export type ReviewCycleAnalyticsState = {
  weeklyReviews: Record<string, number>;
  monthlyReviewerKeys: Record<string, string[]>;
  submissionKeys: string[];
  approvalKeys: string[];
  prStats: Record<
    string,
    { additions: number; totalDurationMs: number; count: number }
  >;
};

/**
 * Normalized analytics document, including the internal merge state.
 *
 * Only the DB layer should use this shape. API responses must call
 * `toReviewerTeamsAnalytics` so the merge state stays server-side.
 */
export type StoredReviewCycleAnalytics = ReviewerTeamsAnalytics & {
  analyticsState?: ReviewCycleAnalyticsState;
};

export type FirestoreReviewCycleAnalytics = ReviewerTeamsAnalytics & {
  computedAt: Timestamp;
  /** Internal merge state used to update analytics without scanning cycles. */
  analyticsState?: ReviewCycleAnalyticsState;
};

/**
 * Asserts that a raw value is an array of objects.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is not an array of objects.
 */
function assertArrayOfObjects(
  field: string,
  value: FirebaseFirestore.DocumentData | undefined,
): void {
  if (!Array.isArray(value)) {
    throw new DbValidationError(field, `${field} must be an array.`);
  }
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      throw new DbValidationError(
        field,
        `Each entry in ${field} must be an object.`,
      );
    }
  }
}

/**
 * Asserts that a raw value is a record of the expected shape.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is not a record.
 */
function assertRecord(
  field: string,
  value: FirebaseFirestore.DocumentData[string],
): asserts value is FirebaseFirestore.DocumentData {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DbValidationError(field, `${field} must be a record.`);
  }
}

/**
 * Validates the optional internal merge state stored on the snapshot.
 *
 * Invalid state is rejected instead of trusted so the caller falls back to a
 * clean bootstrap rather than producing corrupt analytics.
 *
 * @param value The raw `analyticsState` value.
 * @returns Nothing. Throws when the state is malformed.
 */
function assertAnalyticsState(
  value: FirebaseFirestore.DocumentData[string],
): void {
  if (value === undefined) return;

  assertRecord("analyticsState", value);
  assertRecord("analyticsState.weeklyReviews", value.weeklyReviews);
  for (const reviews of Object.values(
    value.weeklyReviews as FirebaseFirestore.DocumentData,
  )) {
    if (typeof reviews !== "number" || !Number.isFinite(reviews)) {
      throw new DbValidationError(
        "analyticsState.weeklyReviews",
        "weeklyReviews values must be finite numbers.",
      );
    }
  }
  assertRecord("analyticsState.monthlyReviewerKeys", value.monthlyReviewerKeys);
  for (const logins of Object.values(
    value.monthlyReviewerKeys as FirebaseFirestore.DocumentData,
  )) {
    if (
      !Array.isArray(logins) ||
      logins.some((login) => typeof login !== "string")
    ) {
      throw new DbValidationError(
        "analyticsState.monthlyReviewerKeys",
        "monthlyReviewerKeys values must be arrays of strings.",
      );
    }
  }
  for (const field of ["submissionKeys", "approvalKeys"]) {
    const keys = value[field];
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string")) {
      throw new DbValidationError(
        `analyticsState.${field}`,
        `${field} must be an array of strings.`,
      );
    }
  }
  assertRecord("analyticsState.prStats", value.prStats);
  for (const stats of Object.values(
    value.prStats as FirebaseFirestore.DocumentData,
  )) {
    if (
      stats === null ||
      typeof stats !== "object" ||
      typeof stats.additions !== "number" ||
      typeof stats.totalDurationMs !== "number" ||
      typeof stats.count !== "number"
    ) {
      throw new DbValidationError(
        "analyticsState.prStats",
        "Each PR stat must have numeric additions, totalDurationMs, and count.",
      );
    }
  }
}

/**
 * Validates the raw Firestore review-cycle analytics document shape.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreReviewCycleAnalytics(
  data: FirebaseFirestore.DocumentData,
): asserts data is FirestoreReviewCycleAnalytics {
  assertArrayOfObjects("weeklyReviews", data.weeklyReviews);
  for (const point of data.weeklyReviews as Array<FirebaseFirestore.DocumentData>) {
    if (
      typeof point.weekStart !== "string" ||
      typeof point.reviews !== "number"
    ) {
      throw new DbValidationError(
        "weeklyReviews",
        "Each weekly review must have a string weekStart and a numeric reviews.",
      );
    }
  }

  assertArrayOfObjects("monthlyUniqueReviewers", data.monthlyUniqueReviewers);
  for (const point of data.monthlyUniqueReviewers as Array<FirebaseFirestore.DocumentData>) {
    if (
      typeof point.month !== "string" ||
      typeof point.uniqueReviewers !== "number"
    ) {
      throw new DbValidationError(
        "monthlyUniqueReviewers",
        "Each monthly point must have a string month and a numeric uniqueReviewers.",
      );
    }
  }

  assertArrayOfObjects("topApprovers", data.topApprovers);
  for (const point of data.topApprovers as Array<FirebaseFirestore.DocumentData>) {
    if (
      typeof point.username !== "string" ||
      typeof point.approvals !== "number" ||
      typeof point.sharePct !== "number"
    ) {
      throw new DbValidationError(
        "topApprovers",
        "Each approver must have a string username and numeric approvals/sharePct.",
      );
    }
  }

  assertArrayOfObjects("prSizeScatter", data.prSizeScatter);
  for (const point of data.prSizeScatter as Array<FirebaseFirestore.DocumentData>) {
    if (
      typeof point.prNumber !== "number" ||
      typeof point.additions !== "number" ||
      typeof point.reviewTimeHours !== "number"
    ) {
      throw new DbValidationError(
        "prSizeScatter",
        "Each scatter point must have numeric prNumber, additions, and reviewTimeHours.",
      );
    }
  }

  if (typeof data.totalApprovals !== "number") {
    throw new DbValidationError(
      "totalApprovals",
      "totalApprovals must be a number.",
    );
  }

  assertTimestamp("ReviewCycleAnalytics", "computedAt", data.computedAt);
  assertAnalyticsState(data.analyticsState);
  assertSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS, data.schemaVersion);
}

/**
 * Normalizes a raw Firestore review-cycle analytics document.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized analytics, including internal merge state.
 */
export function normalizeReviewCycleAnalytics(
  data: FirebaseFirestore.DocumentData,
): StoredReviewCycleAnalytics {
  const migrated = migrateDocument(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS, data);
  assertFirestoreReviewCycleAnalytics(migrated);
  return {
    weeklyReviews: migrated.weeklyReviews,
    monthlyUniqueReviewers: migrated.monthlyUniqueReviewers,
    topApprovers: migrated.topApprovers,
    prSizeScatter: migrated.prSizeScatter,
    totalApprovals: migrated.totalApprovals,
    schemaVersion: migrated.schemaVersion,
    analyticsState: migrated.analyticsState,
  };
}

/**
 * Projects stored analytics onto the public dashboard shape.
 *
 * Strips the internal merge state (seen keys, monthly login lists, per-PR
 * counters) so it never reaches an API response.
 *
 * @param stored The normalized analytics document.
 * @returns The client-safe analytics payload.
 */
export function toReviewerTeamsAnalytics(
  stored: StoredReviewCycleAnalytics,
): ReviewerTeamsAnalytics {
  return {
    weeklyReviews: stored.weeklyReviews,
    monthlyUniqueReviewers: stored.monthlyUniqueReviewers,
    topApprovers: stored.topApprovers,
    prSizeScatter: stored.prSizeScatter,
    totalApprovals: stored.totalApprovals,
    schemaVersion: stored.schemaVersion,
  };
}

/**
 * Serializes review-cycle analytics for Firestore storage.
 *
 * @param analytics The analytics to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCycleAnalytics(
  analytics: Omit<ReviewerTeamsAnalytics, "schemaVersion"> & {
    analyticsState?: ReviewCycleAnalyticsState;
  },
): FirestoreReviewCycleAnalytics {
  return {
    ...analytics,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS),
    computedAt: Timestamp.fromDate(new Date()),
  };
}
