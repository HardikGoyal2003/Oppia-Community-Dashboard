import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
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
  if (
    data.completedReviews !== undefined &&
    typeof data.completedReviews !== "number"
  ) {
    throw new DbValidationError(
      "completedReviews",
      "completedReviews must be a number.",
    );
  }
  if (
    data.avgReviewTimeHours !== undefined &&
    data.avgReviewTimeHours !== null &&
    typeof data.avgReviewTimeHours !== "number"
  ) {
    throw new DbValidationError(
      "avgReviewTimeHours",
      "avgReviewTimeHours must be a number or null.",
    );
  }
  assertTimestamp("Reviewer", "lastUpdated", data.lastUpdated);
}

/**
 * Normalizes a raw Firestore reviewer document into the app model.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized reviewer document.
 */
export function normalizeReviewer(
  data: FirebaseFirestore.DocumentData,
): ReviewerDocument {
  assertFirestoreReviewer(data);
  return {
    teams: data.teams,
    pendingReviews: data.pendingReviews,
    completedReviews: (data.completedReviews as number) ?? 0,
    avgReviewTimeHours:
      data.avgReviewTimeHours !== undefined && data.avgReviewTimeHours !== null
        ? (data.avgReviewTimeHours as number)
        : null,
    lastUpdated: normalizeTimestamp(data.lastUpdated),
  };
}

/**
 * Serializes a reviewer document for Firestore storage.
 *
 * @param doc The reviewer document to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewer(doc: ReviewerDocument): FirestoreReviewer {
  return {
    teams: doc.teams,
    pendingReviews: doc.pendingReviews,
    completedReviews: doc.completedReviews,
    avgReviewTimeHours: doc.avgReviewTimeHours,
    lastUpdated: Timestamp.fromDate(doc.lastUpdated),
  };
}
