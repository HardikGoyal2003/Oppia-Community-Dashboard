import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import { assertTimestamp } from "@/db/utils/timestamp.utils";
import type { ReviewerTeamsAnalytics } from "@/lib/domain/reviewer-teams.types";

export type FirestoreReviewCycleAnalytics = ReviewerTeamsAnalytics & {
  computedAt: Timestamp;
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
}

/**
 * Normalizes a raw Firestore review-cycle analytics document.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized analytics.
 */
export function normalizeReviewCycleAnalytics(
  data: FirebaseFirestore.DocumentData,
): ReviewerTeamsAnalytics {
  assertFirestoreReviewCycleAnalytics(data);
  return {
    weeklyReviews: data.weeklyReviews,
    monthlyUniqueReviewers: data.monthlyUniqueReviewers,
    topApprovers: data.topApprovers,
    prSizeScatter: data.prSizeScatter,
    totalApprovals: data.totalApprovals,
  };
}

/**
 * Serializes review-cycle analytics for Firestore storage.
 *
 * @param analytics The analytics to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCycleAnalytics(
  analytics: ReviewerTeamsAnalytics,
): FirestoreReviewCycleAnalytics {
  return {
    ...analytics,
    computedAt: Timestamp.fromDate(new Date()),
  };
}
