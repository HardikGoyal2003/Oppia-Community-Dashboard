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
 * Per-reviewer facts derived from a reviewer's cycles on one PR.
 *
 * These are PR-level values (rounds, comments, submissions) captured once per
 * reviewer-PR pair so aggregation never double counts them. Storing them on the
 * PR document keeps each document bounded by the number of reviewers on that
 * PR instead of growing with review history.
 */
export type ReviewCyclePrReviewerFact = {
  weekStart: string;
  month: string;
  submissions: number;
  roundsBeforeApproval: number | null;
  comments: number;
  approved: boolean;
};

export type ReviewCyclePrStatsDocument = {
  prNumber: number;
  additions: number | null;
  totalDurationMs: number;
  cycleCount: number;
  reviewers: Record<string, ReviewCyclePrReviewerFact>;
  lastUpdated: Date;
  schemaVersion: number;
};

export type FirestoreReviewCyclePrStats = Omit<
  ReviewCyclePrStatsDocument,
  "lastUpdated"
> & { lastUpdated: Timestamp };

/**
 * Asserts that a field is a finite number.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @returns Nothing. Throws when the value is invalid.
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
 * Asserts that a value is a reviewer fact.
 *
 * @param login The reviewer login the fact belongs to.
 * @param value The raw fact value.
 * @returns Nothing. Throws when the fact is invalid.
 */
function assertReviewerFact(
  login: string,
  value: FirebaseFirestore.DocumentData[string],
): void {
  const field = `reviewers.${login}`;
  if (value === null || typeof value !== "object") {
    throw new DbValidationError(field, "Each reviewer fact must be an object.");
  }
  if (typeof value.weekStart !== "string") {
    throw new DbValidationError(
      `${field}.weekStart`,
      "weekStart must be a string.",
    );
  }
  if (typeof value.month !== "string") {
    throw new DbValidationError(`${field}.month`, "month must be a string.");
  }
  assertFiniteNumber(`${field}.submissions`, value.submissions);
  if (
    value.roundsBeforeApproval !== null &&
    (typeof value.roundsBeforeApproval !== "number" ||
      !Number.isFinite(value.roundsBeforeApproval))
  ) {
    throw new DbValidationError(
      `${field}.roundsBeforeApproval`,
      "roundsBeforeApproval must be a finite number or null.",
    );
  }
  assertFiniteNumber(`${field}.comments`, value.comments);
  if (typeof value.approved !== "boolean") {
    throw new DbValidationError(
      `${field}.approved`,
      "approved must be boolean.",
    );
  }
}

/**
 * Validates a raw PR stats document.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreReviewCyclePrStats(
  data: FirebaseFirestore.DocumentData,
): asserts data is FirestoreReviewCyclePrStats {
  assertFiniteNumber("prNumber", data.prNumber);
  if (
    data.additions !== null &&
    (typeof data.additions !== "number" || !Number.isFinite(data.additions))
  ) {
    throw new DbValidationError(
      "additions",
      "additions must be a finite number or null.",
    );
  }
  assertFiniteNumber("totalDurationMs", data.totalDurationMs);
  assertFiniteNumber("cycleCount", data.cycleCount);

  if (
    data.reviewers === null ||
    typeof data.reviewers !== "object" ||
    Array.isArray(data.reviewers)
  ) {
    throw new DbValidationError("reviewers", "reviewers must be a record.");
  }
  for (const [login, fact] of Object.entries(
    data.reviewers as FirebaseFirestore.DocumentData,
  )) {
    assertReviewerFact(login, fact);
  }

  assertTimestamp("ReviewCyclePrStats", "lastUpdated", data.lastUpdated);
  assertSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_PR_STATS, data.schemaVersion);
}

/**
 * Normalizes a raw PR stats document, migrating legacy shapes first.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized PR stats.
 */
export function normalizeReviewCyclePrStats(
  data: FirebaseFirestore.DocumentData,
): ReviewCyclePrStatsDocument {
  const migrated = migrateDocument(SCHEMA_KEYS.REVIEW_CYCLE_PR_STATS, data);
  assertFirestoreReviewCyclePrStats(migrated);
  return {
    prNumber: migrated.prNumber,
    additions: migrated.additions,
    totalDurationMs: migrated.totalDurationMs,
    cycleCount: migrated.cycleCount,
    reviewers: migrated.reviewers,
    lastUpdated: normalizeTimestamp(migrated.lastUpdated),
    schemaVersion: migrated.schemaVersion,
  };
}

/**
 * Serializes PR stats for Firestore storage.
 *
 * @param document The PR stats to persist.
 * @returns The Firestore-ready document.
 */
export function serializeReviewCyclePrStats(
  document: Omit<ReviewCyclePrStatsDocument, "schemaVersion">,
): FirestoreReviewCyclePrStats {
  return {
    ...document,
    lastUpdated: Timestamp.fromDate(document.lastUpdated),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_PR_STATS),
  };
}
