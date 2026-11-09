import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DailyDiscussionMetric } from "@/lib/domain/daily-discussion-metrics.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type FirestoreDailyDiscussionMetric = Omit<
  DailyDiscussionMetric,
  "capturedAt"
> & {
  capturedAt: Timestamp;
};

/**
 * Validates that a numeric field is present and non-negative.
 *
 * @param value The numeric value candidate.
 * @param field The Firestore field name being validated.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertNonNegativeNumber(
  value: number | undefined,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new DbValidationError(
      field,
      `${field} must be a non-negative number.`,
    );
  }
}

/**
 * Validates the raw Firestore discussion-metric document shape.
 *
 * @param metric The raw Firestore discussion metric data.
 * @returns Nothing. Throws when the stored shape is invalid.
 */
function assertFirestoreDailyDiscussionMetric(
  metric: FirebaseFirestore.DocumentData,
): asserts metric is FirestoreDailyDiscussionMetric {
  if (metric.platform !== "WEB" && metric.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Discussion metric platform must be WEB or ANDROID.",
    );
  }

  if (typeof metric.dateKey !== "string" || !metric.dateKey.trim()) {
    throw new DbValidationError(
      "dateKey",
      "Discussion metric dateKey must be a non-empty string.",
    );
  }

  assertNonNegativeNumber(
    metric.unansweredDiscussionsCount,
    "unansweredDiscussionsCount",
  );
  assertTimestamp("Discussion metric", "capturedAt", metric.capturedAt);
  assertSchemaVersion(
    SCHEMA_KEYS.DAILY_DISCUSSION_METRICS,
    metric.schemaVersion,
  );
}

/**
 * Normalizes raw Firestore discussion-metric data into the app model.
 *
 * @param metric The raw Firestore discussion metric data.
 * @returns The normalized discussion metric.
 */
export function normalizeDailyDiscussionMetricDocument(
  metric: FirebaseFirestore.DocumentData,
): DailyDiscussionMetric {
  const migratedMetric = migrateDocument(
    SCHEMA_KEYS.DAILY_DISCUSSION_METRICS,
    metric,
  );
  assertFirestoreDailyDiscussionMetric(migratedMetric);

  return {
    capturedAt: normalizeTimestamp(migratedMetric.capturedAt),
    dateKey: migratedMetric.dateKey,
    platform: migratedMetric.platform as ContributionPlatform,
    unansweredDiscussionsCount: migratedMetric.unansweredDiscussionsCount,
    schemaVersion: migratedMetric.schemaVersion,
  };
}

/**
 * Serializes a discussion metric for Firestore storage.
 *
 * @param metric The normalized discussion metric.
 * @returns The Firestore-ready discussion metric document.
 */
export function serializeDailyDiscussionMetric(
  metric: Omit<DailyDiscussionMetric, "schemaVersion">,
): FirestoreDailyDiscussionMetric {
  return {
    capturedAt: Timestamp.fromDate(metric.capturedAt),
    dateKey: metric.dateKey,
    platform: metric.platform,
    unansweredDiscussionsCount: metric.unansweredDiscussionsCount,
    schemaVersion: getCurrentSchemaVersion(
      SCHEMA_KEYS.DAILY_DISCUSSION_METRICS,
    ),
  };
}
