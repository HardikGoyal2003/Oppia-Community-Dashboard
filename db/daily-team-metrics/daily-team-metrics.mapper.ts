import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DailyTeamMetric } from "@/lib/domain/daily-team-metrics.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  assertDateKey,
  assertNonEmptyString,
  assertNonNegativeNumber,
} from "@/db/utils/validation.utils";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type FirestoreDailyTeamMetric = Omit<DailyTeamMetric, "capturedAt"> & {
  capturedAt: Timestamp;
};

/**
 * Validates the raw Firestore team-metric document shape.
 *
 * @param metric The raw Firestore team metric data.
 * @returns Nothing. Throws when the stored shape is invalid.
 */
function assertFirestoreDailyTeamMetric(
  metric: FirebaseFirestore.DocumentData,
): asserts metric is FirestoreDailyTeamMetric {
  assertNonEmptyString(
    "teamId",
    metric.teamId,
    "Team metric teamId must be a non-empty string.",
  );
  assertNonEmptyString(
    "teamName",
    metric.teamName,
    "Team metric teamName must be a non-empty string.",
  );

  if (metric.platform !== "WEB" && metric.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Team metric platform must be WEB or ANDROID.",
    );
  }

  assertDateKey(
    "dateKey",
    metric.dateKey,
    "Team metric dateKey must be a YYYY-MM-DD date key.",
  );

  assertNonNegativeNumber(
    "unansweredIssuesCount",
    metric.unansweredIssuesCount,
    "Team metric unansweredIssuesCount must be a non-negative number.",
  );

  assertNonNegativeNumber(
    "maxWaitingDays",
    metric.maxWaitingDays,
    "maxWaitingDays must be a non-negative number.",
  );
  assertTimestamp("Team metric", "capturedAt", metric.capturedAt);
}

/**
 * Normalizes raw Firestore team metric data into the app model.
 *
 * @param metric The raw Firestore team metric data.
 * @returns The normalized team metric.
 */
export function normalizeDailyTeamMetricDocument(
  metric: FirebaseFirestore.DocumentData,
): DailyTeamMetric {
  const migratedMetric = migrateDocument(
    SCHEMA_KEYS.DAILY_TEAM_METRICS,
    metric,
  );
  assertFirestoreDailyTeamMetric(migratedMetric);

  return {
    capturedAt: normalizeTimestamp(migratedMetric.capturedAt),
    dateKey: migratedMetric.dateKey,
    maxWaitingDays: migratedMetric.maxWaitingDays,
    platform: migratedMetric.platform as ContributionPlatform,
    teamId: migratedMetric.teamId,
    teamName: migratedMetric.teamName,
    unansweredIssuesCount: migratedMetric.unansweredIssuesCount,
    schemaVersion: migratedMetric.schemaVersion,
  };
}

/**
 * Serializes a team metric for Firestore storage.
 *
 * @param metric The normalized team metric.
 * @returns The Firestore-ready team metric document.
 */
export function serializeDailyTeamMetric(
  metric: Omit<DailyTeamMetric, "schemaVersion">,
): FirestoreDailyTeamMetric {
  return {
    capturedAt: Timestamp.fromDate(metric.capturedAt),
    dateKey: metric.dateKey,
    maxWaitingDays: metric.maxWaitingDays,
    platform: metric.platform,
    teamId: metric.teamId,
    teamName: metric.teamName,
    unansweredIssuesCount: metric.unansweredIssuesCount,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.DAILY_TEAM_METRICS),
  };
}
