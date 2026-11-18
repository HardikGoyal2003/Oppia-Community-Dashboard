import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DailyDiscussionMetric } from "@/lib/domain/daily-discussion-metrics.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  assertDateKey,
  assertNonNegativeNumber,
} from "@/db/utils/validation.utils";
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

  assertDateKey(
    "dateKey",
    metric.dateKey,
    "Discussion metric dateKey must be a YYYY-MM-DD date key.",
  );

  assertNonNegativeNumber(
    "unansweredDiscussionsCount",
    metric.unansweredDiscussionsCount,
    "unansweredDiscussionsCount must be a non-negative number.",
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
